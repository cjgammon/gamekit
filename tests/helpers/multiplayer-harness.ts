import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { findAvailablePort } from './port-finder';

export interface HarnessOptions {
  preferredServerPort?: number;
  preferredAppPort?: number;
}

export interface HarnessInfo {
  serverUrl: string;
  serverPort: number;
  appUrl: string;
  appPort: number;
}

export interface BrowserSession {
  sessionId: string;
  url: string;
  type: 'host' | 'guest';
}

/**
 * Multiplayer test harness for E2E testing
 * Manages server startup, browser sessions, and state extraction
 */
export class MultiplayerTestHarness {
  private serverProcess: ChildProcess | null = null;
  private appProcess: ChildProcess | null = null;
  private sessions: BrowserSession[] = [];

  public info: HarnessInfo | null = null;

  constructor(private options: HarnessOptions = {}) {}

  /**
   * Start servers with dynamic port allocation
   */
  async startServer(): Promise<HarnessInfo> {
    const preferredServerPort = this.options.preferredServerPort || 3000;
    const preferredAppPort = this.options.preferredAppPort || 5173;

    const serverPort = await findAvailablePort(preferredServerPort);
    const appPort = await findAvailablePort(preferredAppPort);

    console.log(`[Harness] Allocating ports: server=${serverPort}, app=${appPort}`);
    if (serverPort !== preferredServerPort) {
      console.log(`  ⚠️  Server port ${preferredServerPort} in use, using ${serverPort}`);
    }
    if (appPort !== preferredAppPort) {
      console.log(`  ⚠️  App port ${preferredAppPort} in use, using ${appPort}`);
    }

    this.info = {
      serverUrl: `http://localhost:${serverPort}`,
      serverPort,
      appUrl: `http://localhost:${appPort}`,
      appPort,
    };

    await this.startGameServer(serverPort);
    await this.startViteServer(appPort);

    console.log(`✓ [Harness] Ready - ${this.info.serverUrl} / ${this.info.appUrl}`);

    return this.info;
  }

  /**
   * Start GameKit server
   */
  private async startGameServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [
        'examples/pong/server.js'
      ], {
        env: {
          ...process.env,
          TEST_MODE: 'true',
          PORT: port.toString(),
        },
        stdio: 'pipe',
      });

      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('GameKit Server running')) {
          console.log(`  ✓ GameKit server started on port ${port}`);
          resolve();
        }
      });

      this.serverProcess.on('error', reject);

      setTimeout(() => reject(new Error('Server start timeout')), 10000);
    });
  }

  /**
   * Start Vite dev server
   */
  private async startViteServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.appProcess = spawn('npx', [
        'vite',
        'examples/pong',
        '--port', port.toString(),
        '--strictPort',
      ], {
        stdio: 'pipe',
      });

      this.appProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:') || output.includes('ready in')) {
          console.log(`  ✓ Vite dev server started on port ${port}`);
          resolve();
        }
      });

      this.appProcess.on('error', reject);

      setTimeout(() => reject(new Error('Vite start timeout')), 20000);
    });
  }

  /**
   * Execute playwright-cli command
   */
  private async exec(sessionId: string, command: string, ...args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // If args are provided, use them directly; otherwise parse command string
      const commandArgs = args.length > 0 ? [command, ...args] : command.split(' ');
      const proc = spawn('playwright-cli', ['-s', sessionId, ...commandArgs]);

      let output = '';
      proc.stdout?.on('data', (data) => output += data.toString());
      proc.stderr?.on('data', (data) => output += data.toString());

      proc.on('close', (code) => {
        if (code === 0) {
          // playwright-cli returns output like:
          // ### Result
          // "actual result"
          // ### Ran Playwright code
          // ...
          // Extract just the result between the first two ### markers
          const resultMatch = output.match(/### Result\s*\n(.*?)\n###/s);
          if (resultMatch) {
            let result = resultMatch[1].trim();
            // If it's a JSON string (starts and ends with quotes), parse it to handle escaping
            if (result.startsWith('"') && result.endsWith('"')) {
              try {
                // This will properly handle escaped characters like \", \\, etc.
                result = JSON.parse(result);
              } catch (e) {
                // If JSON parse fails, fall back to simple slice
                result = result.slice(1, -1);
              }
            }
            resolve(result);
          } else {
            resolve(output);
          }
        } else {
          reject(new Error(`Command failed: ${command}\n${output}`));
        }
      });
    });
  }

  /**
   * Open browser with playwright-cli
   */
  private async openBrowser(sessionId: string, url: string): Promise<void> {
    await this.exec(sessionId, 'open', url);
  }

  /**
   * Create host session
   */
  async createHost(sessionId: string, playerName: string = 'Host'): Promise<string> {
    if (!this.info) {
      throw new Error('Server not started - call startServer() first');
    }

    const url = `${this.info.appUrl}?server=${encodeURIComponent(this.info.serverUrl)}`;
    await this.openBrowser(sessionId, url);

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enable test mode for message history tracking
    await this.exec(sessionId, 'eval', 'window.__GAMEKIT_TEST_MODE__ = true');

    // Wait for room to be created (retry up to 10 times with 500ms delay)
    let roomCode = '';
    for (let i = 0; i < 10; i++) {
      roomCode = await this.exec(sessionId, 'eval', "window.game?.getRoomCode() || ''");
      if (roomCode.trim()) {
        break;
      }
      console.log(`  Waiting for room creation... (attempt ${i + 1}/10)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!roomCode.trim()) {
      throw new Error('Failed to create room - no room code returned after 10 attempts');
    }

    this.sessions.push({
      sessionId,
      url: this.info.appUrl,
      type: 'host',
    });

    return roomCode.trim();
  }

  /**
   * Create guest session
   */
  async createGuest(sessionId: string, roomCode: string, playerName: string = 'Guest'): Promise<void> {
    if (!this.info) {
      throw new Error('Server not started');
    }

    const url = `${this.info.appUrl}?room=${roomCode}&server=${encodeURIComponent(this.info.serverUrl)}`;
    await this.openBrowser(sessionId, url);

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enable test mode for message history tracking
    await this.exec(sessionId, 'eval', 'window.__GAMEKIT_TEST_MODE__ = true');

    this.sessions.push({
      sessionId,
      url,
      type: 'guest',
    });
  }

  /**
   * Extract game state from browser
   * Returns test API with callable methods
   */
  async getGameState(sessionId: string): Promise<any> {
    // Return a proxy object that makes remote calls for each method
    return {
      getSprites: async () => {
        const raw = await this.exec(
          sessionId,
          'eval',
          'JSON.stringify(window.game?.getTestAPI().getSprites() || [])'
        );
        // Handle potential double-stringification
        try {
          return JSON.parse(raw);
        } catch (e) {
          // If first parse fails, try parsing as a JSON string
          return JSON.parse(JSON.parse(raw));
        }
      },
      getMessageHistory: async () => {
        const raw = await this.exec(
          sessionId,
          'eval',
          'JSON.stringify(window.game?.getTestAPI().getMessageHistory() || [])'
        );
        try {
          return JSON.parse(raw);
        } catch (e) {
          return JSON.parse(JSON.parse(raw));
        }
      },
      getNetworkState: async () => {
        const raw = await this.exec(
          sessionId,
          'eval',
          'JSON.stringify(window.game?.getTestAPI().getNetworkState() || {})'
        );
        try {
          return JSON.parse(raw);
        } catch (e) {
          return JSON.parse(JSON.parse(raw));
        }
      },
      getFrameCount: async () => {
        const result = await this.exec(
          sessionId,
          'eval',
          'window.game?.getTestAPI().getFrameCount() || 0'
        );
        return parseInt(result);
      },
    };
  }

  /**
   * Get server state for room
   */
  async getServerState(roomCode: string): Promise<any> {
    if (!this.info) {
      throw new Error('Server not started');
    }

    const response = await fetch(`${this.info.serverUrl}/test/rooms/${roomCode}/state`);
    return await response.json();
  }

  /**
   * Take screenshot of session
   */
  async screenshot(sessionId: string, filename: string): Promise<void> {
    await this.exec(sessionId, `screenshot --filename=${filename}`);
  }

  /**
   * Cleanup - close browsers and stop servers
   */
  async cleanup(): Promise<void> {
    // Close all browser sessions
    for (const session of this.sessions) {
      try {
        // Use spawn directly for close command (doesn't return structured output)
        await new Promise<void>((resolve) => {
          const proc = spawn('playwright-cli', ['-s', session.sessionId, 'close']);
          proc.on('close', () => resolve());
          // Timeout after 2 seconds
          setTimeout(() => resolve(), 2000);
        });
      } catch (e) {
        console.warn(`Failed to close session ${session.sessionId}`);
      }
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    if (this.appProcess) {
      this.appProcess.kill();
      this.appProcess = null;
    }

    this.sessions = [];
    this.info = null;
  }
}
