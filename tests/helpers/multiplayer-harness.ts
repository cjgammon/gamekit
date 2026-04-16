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
  private async exec(sessionId: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = command.split(' ');
      const proc = spawn('playwright-cli', ['-s', sessionId, ...args]);

      let output = '';
      proc.stdout?.on('data', (data) => output += data.toString());
      proc.stderr?.on('data', (data) => output += data.toString());

      proc.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Command failed: ${command}\n${output}`));
      });
    });
  }

  /**
   * Open browser with playwright-cli
   */
  private async openBrowser(sessionId: string, url: string): Promise<void> {
    await this.exec(sessionId, `open ${url}`);
  }

  /**
   * Create host session
   */
  async createHost(sessionId: string, playerName: string = 'Host'): Promise<string> {
    if (!this.info) {
      throw new Error('Server not started - call startServer() first');
    }

    await this.openBrowser(sessionId, this.info.appUrl);
    await this.exec(sessionId, 'sleep 2');

    // Enable test mode for message history tracking
    await this.exec(sessionId, `eval "window.__GAMEKIT_TEST_MODE__ = true"`);

    // Extract room code from game
    const roomCode = await this.exec(sessionId,
      `eval "window.game?.getRoomCode() || ''"`
    );

    if (!roomCode.trim()) {
      throw new Error('Failed to create room - no room code returned');
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

    const url = `${this.info.appUrl}?room=${roomCode}`;
    await this.openBrowser(sessionId, url);
    await this.exec(sessionId, 'sleep 2');

    // Enable test mode for message history tracking
    await this.exec(sessionId, `eval "window.__GAMEKIT_TEST_MODE__ = true"`);

    this.sessions.push({
      sessionId,
      url,
      type: 'guest',
    });
  }

  /**
   * Extract game state from browser
   */
  async getGameState(sessionId: string): Promise<any> {
    const stateJson = await this.exec(sessionId,
      `eval "JSON.stringify(window.game?.getTestAPI() || {})"`
    );

    return JSON.parse(stateJson || '{}');
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
    for (const session of this.sessions) {
      try {
        await this.exec(session.sessionId, 'close');
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
