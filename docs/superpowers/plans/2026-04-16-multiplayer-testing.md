# Multiplayer Testing Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build comprehensive E2E testing infrastructure to catch multiplayer sprite synchronization bugs (frozen sprites, desyncs) by verifying state consistency across host client, server, and guest client.

**Architecture:** Three-layer testing: (1) Client instrumentation exposes game state via test API, (2) Server test endpoints expose room/message state, (3) Playwright test harness orchestrates multi-browser E2E tests with automatic port allocation and rich failure debugging.

**Tech Stack:** TypeScript, Bun test runner, Playwright CLI, Node.js net module for port detection

---

## File Structure

### New Files
- `tests/helpers/port-finder.ts` - Dynamic port allocation utility
- `tests/helpers/multiplayer-harness.ts` - Test orchestration (spawn browsers, manage sessions)
- `tests/helpers/assertions.ts` - Sync-specific assertion helpers
- `tests/helpers/debug-tools.ts` - Failure capture and state diffing
- `tests/multiplayer-sync.test.ts` - Core synchronization tests
- `tests/multiplayer-gameplay.test.ts` - Gameplay flow tests
- `tests/multiplayer-network.test.ts` - Network reliability tests
- `packages/gamekit-server/src/test-endpoints.ts` - HTTP test endpoints for server state
- `.env.test` - Test environment configuration
- `test-artifacts/.gitignore` - Ignore test artifacts
- `.github/workflows/e2e-tests.yml` - CI/CD configuration

### Modified Files
- `packages/gamekit/src/game.ts` - Add getTestAPI() method and frame counter
- `packages/gamekit/src/network.ts` - Add message history tracking
- `packages/gamekit-server/src/types.ts` - Add testMode flag and messageHistory field
- `packages/gamekit-server/src/server.ts` - Wire up test endpoints when testMode enabled
- `packages/gamekit-server/src/room-manager.ts` - Add getAllRooms() method
- `package.json` - Add test scripts
- `.gitignore` - Add test-artifacts/

---

## Task 1: Setup Test Infrastructure Files

**Files:**
- Create: `tests/helpers/.gitkeep`
- Create: `test-artifacts/.gitignore`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Create tests directory structure**

```bash
mkdir -p tests/helpers
touch tests/helpers/.gitkeep
```

- [ ] **Step 2: Create test artifacts directory and gitignore**

```bash
mkdir -p test-artifacts
```

Create `test-artifacts/.gitignore`:
```
*
!.gitignore
```

- [ ] **Step 3: Update root .gitignore**

Add to `.gitignore`:
```
# Test artifacts
test-artifacts/

# Test environment
.env.test.local
```

- [ ] **Step 4: Add test scripts to package.json**

Add to `scripts` section in `package.json`:
```json
{
  "test:e2e": "bun test tests/**/*.test.ts",
  "test:e2e:watch": "bun test --watch tests/**/*.test.ts",
  "test:e2e:debug": "bun test --bail tests/**/*.test.ts"
}
```

- [ ] **Step 5: Commit**

```bash
git add tests/ test-artifacts/.gitignore .gitignore package.json
git commit -m "chore: setup test infrastructure directories"
```

---

## Task 2: Port Finder Utility

**Files:**
- Create: `tests/helpers/port-finder.ts`

- [ ] **Step 1: Write failing test for port finder**

Create `tests/helpers/port-finder.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test';
import { findAvailablePort } from './port-finder';
import net from 'net';

describe('Port Finder', () => {
  test('finds available port starting from base', async () => {
    const port = await findAvailablePort(9000);
    expect(port).toBeGreaterThanOrEqual(9000);
    expect(port).toBeLessThan(9100);
  });

  test('skips occupied ports', async () => {
    // Occupy port 9001
    const server = net.createServer();
    await new Promise(resolve => server.listen(9001, resolve));

    try {
      const port = await findAvailablePort(9001);
      expect(port).toBeGreaterThan(9001);
    } finally {
      server.close();
    }
  });

  test('throws when no ports available in range', async () => {
    await expect(findAvailablePort(65535)).rejects.toThrow('No available ports');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/helpers/port-finder.test.ts
```

Expected: FAIL with "Cannot find module './port-finder'"

- [ ] **Step 3: Implement port finder**

Create `tests/helpers/port-finder.ts`:
```typescript
import net from 'net';

/**
 * Find an available port starting from basePort
 * @param basePort - Starting port to check
 * @returns First available port
 * @throws Error if no ports available within 100 attempts
 */
export async function findAvailablePort(basePort: number): Promise<number> {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false); // Port in use
      });

      server.once('listening', () => {
        server.close();
        resolve(true); // Port available
      });

      server.listen(port);
    });
  };

  let port = basePort;
  const maxAttempts = 100;

  while (!(await isPortAvailable(port))) {
    port++;
    if (port > basePort + maxAttempts) {
      throw new Error(`No available ports found in range ${basePort}-${port}`);
    }
  }

  return port;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/helpers/port-finder.test.ts
```

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/port-finder.ts tests/helpers/port-finder.test.ts
git commit -m "feat: add dynamic port finder utility"
```

---

## Task 3: Client Test API - Network Message History

**Files:**
- Modify: `packages/gamekit/src/network.ts:1-320`

- [ ] **Step 1: Add message history field and tracking**

In `packages/gamekit/src/network.ts`, add after line 25 (after `private syncInterval`):

```typescript
  // Message history for test debugging
  private messageHistory: Array<{
    timestamp: number;
    event: string;
    data: any;
  }> = [];
```

- [ ] **Step 2: Track spriteSync messages**

In `setupEventHandlers()` method, modify the `spriteSync` handler (around line 147):

```typescript
    // Sprite position sync
    let syncReceiveCount = 0;
    this.socket.on('spriteSync', (data: { playerId: string; sprites: any[] }) => {
      // Track for tests
      this.messageHistory.push({
        timestamp: Date.now(),
        event: 'spriteSync',
        data: data,
      });

      syncReceiveCount++;
      if (syncReceiveCount === 1) {
        console.log(`📡 [Network] Receiving sprite updates from other players`);
      }

      // Call all sprite sync callbacks with the data
      this.spriteSyncCallbacks.forEach(cb => cb(data));
    });
```

- [ ] **Step 3: Track playerJoined messages**

In `setupEventHandlers()` method, modify the `playerJoined` handler (around line 134):

```typescript
    // Player joined (server sends { player: ... })
    this.socket.on('playerJoined', (data: { player: Player }) => {
      this.messageHistory.push({
        timestamp: Date.now(),
        event: 'playerJoined',
        data: data,
      });

      console.log(`👋 [Network] Player joined: ${data.player.name}`);
      this.playerJoinCallbacks.forEach(cb => cb(data.player));
    });
```

- [ ] **Step 4: Track playerLeft messages**

In `setupEventHandlers()` method, modify the `playerLeft` handler (around line 140):

```typescript
    // Player left (server sends { playerId: ... })
    this.socket.on('playerLeft', (data: { playerId: string }) => {
      this.messageHistory.push({
        timestamp: Date.now(),
        event: 'playerLeft',
        data: data,
      });

      console.log(`👋 [Network] Player left: ${data.playerId}`);
      this.playerLeaveCallbacks.forEach(cb => cb({ id: data.playerId }));
    });
```

- [ ] **Step 5: Add message history getter**

Add method at the end of the Network class (after `disconnect()` method, around line 318):

```typescript
  /**
   * Get message history (for testing)
   */
  getMessageHistory(): Array<{ timestamp: number; event: string; data: any }> {
    return this.messageHistory.slice(); // Return copy
  }
```

- [ ] **Step 6: Commit**

```bash
git add packages/gamekit/src/network.ts
git commit -m "feat: add message history tracking to Network class"
```

---

## Task 4: Client Test API - Frame Counter

**Files:**
- Modify: `packages/gamekit/src/game.ts:1-269`

- [ ] **Step 1: Add frame counter field**

In `packages/gamekit/src/game.ts`, add after line 28 (after `private lastTime`):

```typescript
  private frameCount: number = 0;
```

- [ ] **Step 2: Increment frame counter in game loop**

In `startGameLoop()` method, add after line 73 (after `this.lastTime = now`):

```typescript
      const now = performance.now();
      const delta = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.frameCount++; // Increment frame counter
```

- [ ] **Step 3: Commit**

```bash
git add packages/gamekit/src/game.ts
git commit -m "feat: add frame counter to game loop"
```

---

## Task 5: Client Test API - getTestAPI Method

**Files:**
- Modify: `packages/gamekit/src/game.ts:260-269`

- [ ] **Step 1: Add getTestAPI method**

Add at the end of the Game class (after `onSpriteSync()` method, before the closing brace):

```typescript
  // ============================================================
  // Test API (test mode only)
  // ============================================================

  /**
   * Get test API for E2E testing
   * Returns game state for assertions
   */
  getTestAPI() {
    return {
      // Sprite state
      getSprites: () => this.sprites.map(s => ({
        syncId: s.syncId,
        x: s.x,
        y: s.y,
        angle: s.angle,
        velocityX: s.velocityX,
        velocityY: s.velocityY,
        isOwned: s.isOwned,
      })),

      // Network state
      getNetworkState: () => ({
        isConnected: this.network['socket'] !== null,
        roomCode: this.network.getRoomCode(),
        player: this.network.getPlayer(),
      }),

      // Message history
      getMessageHistory: () => this.network.getMessageHistory(),

      // Frame count for timing verification
      getFrameCount: () => this.frameCount,
    };
  }
}
```

- [ ] **Step 2: Build client package**

```bash
cd packages/gamekit
bun run build
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/gamekit/src/game.ts
git commit -m "feat: add getTestAPI method to Game class"
```

---

## Task 6: Server Types - Add testMode and messageHistory

**Files:**
- Modify: `packages/gamekit-server/src/types.ts:1-100`

- [ ] **Step 1: Add testMode to ServerOptions**

In `packages/gamekit-server/src/types.ts`, find the `ServerOptions` interface (around line 10) and add:

```typescript
export interface ServerOptions {
  port?: number;
  cors?: any;
  hooks?: ServerHooks;
  testMode?: boolean; // Enable test endpoints
}
```

- [ ] **Step 2: Add messageHistory to Room interface**

Find the `Room` interface (around line 25) and add:

```typescript
export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  spriteState: Map<string, SpriteSnapshot[]>;
  createdAt: number;
  messageHistory?: Array<{
    timestamp: number;
    type: 'spriteSync' | 'gameEvent' | 'playerJoined' | 'playerLeft';
    playerId: string;
    data: any;
  }>;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/gamekit-server/src/types.ts
git commit -m "feat: add testMode and messageHistory to server types"
```

---

## Task 7: Server - Add getAllRooms to RoomManager

**Files:**
- Modify: `packages/gamekit-server/src/room-manager.ts`

- [ ] **Step 1: Add getAllRooms method**

Add at the end of the `RoomManager` class (before the closing brace):

```typescript
  /**
   * Get all rooms (for testing)
   */
  getAllRooms(): Map<string, Room> {
    return this.rooms;
  }
```

- [ ] **Step 2: Commit**

```bash
git add packages/gamekit-server/src/room-manager.ts
git commit -m "feat: add getAllRooms method to RoomManager"
```

---

## Task 8: Server Test Endpoints

**Files:**
- Create: `packages/gamekit-server/src/test-endpoints.ts`

- [ ] **Step 1: Create TestEndpoints class**

Create `packages/gamekit-server/src/test-endpoints.ts`:

```typescript
import type { Server as HttpServer } from 'http';
import type { RoomManager } from './room-manager.js';

/**
 * Test-only HTTP endpoints for inspecting server state
 * Only enabled when testMode is true in ServerOptions
 */
export class TestEndpoints {
  constructor(
    private httpServer: HttpServer,
    private roomManager: RoomManager
  ) {}

  /**
   * Set up test-only HTTP endpoints
   * Wraps the existing HTTP server request handler
   */
  setup(): void {
    const originalListener = this.httpServer.listeners('request')[0] as any;

    this.httpServer.removeAllListeners('request');
    this.httpServer.on('request', (req, res) => {
      // Test endpoints
      if (req.url === '/test/rooms') {
        this.handleGetRooms(res);
        return;
      }

      if (req.url?.startsWith('/test/rooms/')) {
        const stateMatch = req.url.match(/\/test\/rooms\/([^\/]+)\/state$/);
        if (stateMatch) {
          this.handleGetRoomState(stateMatch[1], res);
          return;
        }

        const msgMatch = req.url.match(/\/test\/rooms\/([^\/]+)\/messages$/);
        if (msgMatch) {
          this.handleGetRoomMessages(msgMatch[1], res);
          return;
        }
      }

      // Fall back to original handler (health endpoint)
      if (originalListener) {
        originalListener.call(this.httpServer, req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    console.log('[TestEndpoints] Enabled at /test/*');
  }

  /**
   * GET /test/rooms
   * Returns list of all active rooms
   */
  private handleGetRooms(res: any): void {
    const rooms = Array.from(this.roomManager.getAllRooms()).map(([code, room]) => ({
      code,
      playerCount: room.players.size,
      hostId: room.hostId,
      createdAt: room.createdAt,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rooms }));
  }

  /**
   * GET /test/rooms/:code/state
   * Returns full room state for a specific room
   */
  private handleGetRoomState(code: string, res: any): void {
    const room = this.roomManager.getRoom(code.toUpperCase());

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room not found' }));
      return;
    }

    // Convert Map to object for JSON serialization
    const spriteStateObj: Record<string, any[]> = {};
    for (const [playerId, sprites] of room.spriteState.entries()) {
      spriteStateObj[playerId] = sprites;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score,
      })),
      sprites: spriteStateObj,
      createdAt: room.createdAt,
    }));
  }

  /**
   * GET /test/rooms/:code/messages
   * Returns message history for a room
   */
  private handleGetRoomMessages(code: string, res: any): void {
    const room = this.roomManager.getRoom(code.toUpperCase());

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      messages: room.messageHistory || [],
    }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/gamekit-server/src/test-endpoints.ts
git commit -m "feat: add TestEndpoints class for server state inspection"
```

---

## Task 9: Server - Wire Up Test Endpoints

**Files:**
- Modify: `packages/gamekit-server/src/server.ts:1-101`

- [ ] **Step 1: Import TestEndpoints**

Add import at the top of `packages/gamekit-server/src/server.ts`:

```typescript
import { TestEndpoints } from './test-endpoints.js';
```

- [ ] **Step 2: Add testEndpoints field**

In the `GameKitServer` class, add after line 13 (after `private eventHandlers`):

```typescript
  private testEndpoints?: TestEndpoints;
```

- [ ] **Step 3: Set up test endpoints in constructor**

In the constructor, add at the end (before the closing brace, after line 47):

```typescript
    // Set up test endpoints if enabled
    if (options.testMode) {
      console.log('[TEST MODE] Enabling test endpoints at /test/*');
      this.testEndpoints = new TestEndpoints(this.httpServer, this.roomManager);
      this.testEndpoints.setup();
    }
```

- [ ] **Step 4: Build server package**

```bash
cd packages/gamekit-server
bun run build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/gamekit-server/src/server.ts
git commit -m "feat: wire up test endpoints when testMode enabled"
```

---

## Task 10: Multiplayer Test Harness

**Files:**
- Create: `tests/helpers/multiplayer-harness.ts`

- [ ] **Step 1: Create harness skeleton with types**

Create `tests/helpers/multiplayer-harness.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/multiplayer-harness.ts
git commit -m "feat: add multiplayer test harness"
```

---

## Task 11: Sync Assertion Helpers

**Files:**
- Create: `tests/helpers/assertions.ts`

- [ ] **Step 1: Create assertion helper class**

Create `tests/helpers/assertions.ts`:

```typescript
export interface SpriteState {
  syncId: string;
  x: number;
  y: number;
  angle: number;
  velocityX: number;
  velocityY: number;
}

export interface MessageRecord {
  timestamp: number;
  event: string;
  data: any;
}

/**
 * Sync-specific assertion helpers for multiplayer tests
 */
export class SyncAssertions {
  /**
   * Assert sprite position matches between two states within tolerance
   */
  static assertSpritePositionMatches(
    sprite1: SpriteState,
    sprite2: SpriteState,
    tolerance: number = 5
  ): void {
    const dx = Math.abs(sprite1.x - sprite2.x);
    const dy = Math.abs(sprite1.y - sprite2.y);

    if (dx > tolerance || dy > tolerance) {
      throw new Error(
        `Sprite position mismatch:\n` +
        `  Sprite 1: (${sprite1.x.toFixed(2)}, ${sprite1.y.toFixed(2)})\n` +
        `  Sprite 2: (${sprite2.x.toFixed(2)}, ${sprite2.y.toFixed(2)})\n` +
        `  Delta: (${dx.toFixed(2)}, ${dy.toFixed(2)}) > tolerance ${tolerance}`
      );
    }
  }

  /**
   * Assert sprite exists in sprite array
   */
  static assertSpriteExists(
    sprites: SpriteState[],
    syncId: string
  ): SpriteState {
    const sprite = sprites.find(s => s.syncId === syncId);

    if (!sprite) {
      throw new Error(
        `Sprite ${syncId} not found. Available: ${sprites.map(s => s.syncId).join(', ')}`
      );
    }

    return sprite;
  }

  /**
   * Assert network message was received within time window
   */
  static assertMessageReceived(
    messageHistory: MessageRecord[],
    eventName: string,
    withinMs: number = 5000
  ): MessageRecord {
    const now = Date.now();
    const message = messageHistory.find(
      m => m.event === eventName && (now - m.timestamp) < withinMs
    );

    if (!message) {
      const recentEvents = messageHistory.slice(-5).map(m => m.event).join(', ');
      throw new Error(
        `Message '${eventName}' not received within ${withinMs}ms.\n` +
        `Recent messages: ${recentEvents}`
      );
    }

    return message;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/assertions.ts
git commit -m "feat: add sync assertion helpers"
```

---

## Task 12: Debug Tools

**Files:**
- Create: `tests/helpers/debug-tools.ts`

- [ ] **Step 1: Create debug tools class**

Create `tests/helpers/debug-tools.ts`:

```typescript
import { writeFile, mkdir } from 'fs/promises';
import type { MultiplayerTestHarness } from './multiplayer-harness';

/**
 * Debugging utilities for test failure investigation
 */
export class DebugTools {
  /**
   * Capture comprehensive failure state
   * Screenshots + state dumps + server state
   */
  static async captureFailureState(
    harness: MultiplayerTestHarness,
    testName: string,
    sessions: string[],
    roomCode: string
  ): Promise<void> {
    const timestamp = Date.now();
    const safeName = testName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const dir = `./test-artifacts/${safeName}-${timestamp}`;

    // Create directory
    await mkdir(dir, { recursive: true });

    console.log(`\n📸 Capturing failure state to: ${dir}`);

    // Screenshots from all sessions
    for (const session of sessions) {
      try {
        await harness.screenshot(session, `${dir}/${session}.png`);
        console.log(`  ✓ Screenshot: ${session}.png`);
      } catch (e) {
        console.warn(`  ⚠️  Failed to screenshot ${session}:`, e);
      }
    }

    // Get state from all sources
    const clientStates = [];
    for (const session of sessions) {
      try {
        const state = await harness.getGameState(session);
        clientStates.push({ session, state });
      } catch (e) {
        console.warn(`  ⚠️  Failed to get state from ${session}:`, e);
        clientStates.push({ session, state: null, error: String(e) });
      }
    }

    let serverState = null;
    try {
      serverState = await harness.getServerState(roomCode);
      console.log(`  ✓ Server state captured`);
    } catch (e) {
      console.warn(`  ⚠️  Failed to get server state:`, e);
      serverState = { error: String(e) };
    }

    // Write state dump
    const stateDump = {
      timestamp,
      testName,
      sessions,
      roomCode,
      clientStates,
      serverState,
    };

    await writeFile(
      `${dir}/state-dump.json`,
      JSON.stringify(stateDump, null, 2)
    );

    console.log(`  ✓ State dump: state-dump.json`);
    console.log(`\n📸 Failure state captured: ${dir}\n`);
  }

  /**
   * Compare two game states and report differences
   */
  static diffStates(state1: any, state2: any, label1: string, label2: string): string {
    const diffs: string[] = [];

    if (!state1.getSprites || !state2.getSprites) {
      return 'One or both states missing getSprites method';
    }

    const sprites1 = state1.getSprites();
    const sprites2 = state2.getSprites();

    // Compare sprite counts
    if (sprites1.length !== sprites2.length) {
      diffs.push(
        `Sprite count: ${label1}=${sprites1.length}, ${label2}=${sprites2.length}`
      );
    }

    // Compare sprite positions
    for (const s1 of sprites1) {
      const s2 = sprites2.find((s: any) => s.syncId === s1.syncId);
      if (s2) {
        const dx = Math.abs(s1.x - s2.x);
        const dy = Math.abs(s1.y - s2.y);
        if (dx > 5 || dy > 5) {
          diffs.push(
            `Sprite ${s1.syncId}: ${label1}=(${s1.x.toFixed(2)},${s1.y.toFixed(2)}), ` +
            `${label2}=(${s2.x.toFixed(2)},${s2.y.toFixed(2)}), delta=(${dx.toFixed(2)},${dy.toFixed(2)})`
          );
        }
      } else {
        diffs.push(`Sprite ${s1.syncId}: exists in ${label1} but not in ${label2}`);
      }
    }

    return diffs.length > 0 ? diffs.join('\n') : 'No significant differences';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/debug-tools.ts
git commit -m "feat: add debug tools for failure investigation"
```

---

## Task 13: Core Sync Tests

**Files:**
- Create: `tests/multiplayer-sync.test.ts`

- [ ] **Step 1: Create sync test suite**

Create `tests/multiplayer-sync.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { MultiplayerTestHarness } from './helpers/multiplayer-harness';
import { SyncAssertions } from './helpers/assertions';
import { DebugTools } from './helpers/debug-tools';

describe('Multiplayer Sprite Synchronization', () => {
  let harness: MultiplayerTestHarness;
  let roomCode: string;
  const HOST_SESSION = 'sync-test-host';
  const GUEST_SESSION = 'sync-test-guest';

  beforeAll(async () => {
    harness = new MultiplayerTestHarness({
      preferredServerPort: 3000,
      preferredAppPort: 5173,
    });

    const info = await harness.startServer();
    console.log(`Test running on: ${info.serverUrl} / ${info.appUrl}`);

    roomCode = await harness.createHost(HOST_SESSION, 'Player1');
    await harness.createGuest(GUEST_SESSION, roomCode, 'Player2');

    // Wait for initial connection and sync
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  test('paddle position syncs from host to guest', async () => {
    try {
      // Host moves paddle
      await harness.exec(HOST_SESSION, 'eval "window.myPaddle.y = 400"');

      // Wait for sync cycle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get states
      const hostState = await harness.getGameState(HOST_SESSION);
      const guestState = await harness.getGameState(GUEST_SESSION);

      // Find host's paddle
      const hostSprites = hostState.getSprites();
      const hostPaddle = hostSprites.find((s: any) => s.isOwned);

      // Find remote paddle in guest
      const guestSprites = guestState.getSprites();
      const guestRemotePaddle = guestSprites.find((s: any) => !s.isOwned);

      expect(hostPaddle).toBeDefined();
      expect(guestRemotePaddle).toBeDefined();

      // Assert positions match
      SyncAssertions.assertSpritePositionMatches(
        hostPaddle,
        guestRemotePaddle,
        5
      );

      console.log('✓ Paddle synced successfully');
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'paddle-sync-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  });

  test('guest receives spriteSync messages', async () => {
    try {
      // Host moves paddle
      await harness.exec(HOST_SESSION, 'eval "window.myPaddle.y = 200"');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Check guest received message
      const guestState = await harness.getGameState(GUEST_SESSION);
      const messages = guestState.getMessageHistory();

      SyncAssertions.assertMessageReceived(
        messages,
        'spriteSync',
        5000
      );

      console.log('✓ Guest received spriteSync message');
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'spriteSync-message-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  });

  test('frozen sprite detection - catches stuck remote sprites', async () => {
    try {
      // Move paddle to position 1
      await harness.exec(HOST_SESSION, 'eval "window.myPaddle.y = 100"');
      await new Promise(resolve => setTimeout(resolve, 200));

      const state1 = await harness.getGameState(GUEST_SESSION);
      const sprites1 = state1.getSprites();
      const paddle1 = sprites1.find((s: any) => !s.isOwned);

      // Move paddle to position 2
      await harness.exec(HOST_SESSION, 'eval "window.myPaddle.y = 500"');
      await new Promise(resolve => setTimeout(resolve, 200));

      const state2 = await harness.getGameState(GUEST_SESSION);
      const sprites2 = state2.getSprites();
      const paddle2 = sprites2.find((s: any) => !s.isOwned);

      expect(paddle1).toBeDefined();
      expect(paddle2).toBeDefined();

      // Paddle should have moved
      const moved = Math.abs(paddle2.y - paddle1.y) > 300;

      if (!moved) {
        await DebugTools.captureFailureState(
          harness,
          'frozen-sprite-detection',
          [HOST_SESSION, GUEST_SESSION],
          roomCode
        );

        throw new Error(
          `Frozen sprite detected!\n` +
          `  Host paddle moved: 100 → 500\n` +
          `  Guest saw: ${paddle1.y.toFixed(2)} → ${paddle2.y.toFixed(2)}\n` +
          `  Delta: ${Math.abs(paddle2.y - paddle1.y).toFixed(2)} (expected > 300)`
        );
      }

      console.log('✓ No frozen sprites detected');
    } catch (error) {
      // Failure already captured in the if block above
      throw error;
    }
  });
});
```

- [ ] **Step 2: Run test to verify infrastructure works**

```bash
bun test tests/multiplayer-sync.test.ts
```

Expected: Tests should run (may fail on assertions if game code has bugs)

- [ ] **Step 3: Commit**

```bash
git add tests/multiplayer-sync.test.ts
git commit -m "test: add core sprite synchronization tests"
```

---

## Task 14: Environment Configuration

**Files:**
- Create: `.env.test`

- [ ] **Step 1: Create test environment file**

Create `.env.test`:
```bash
# Test Mode
TEST_MODE=true

# Port Configuration
TEST_SERVER_PORT=3000
TEST_APP_PORT=5173

# Test Timeouts
TEST_TIMEOUT=30000

# Artifacts
SCREENSHOT_DIR=./test-artifacts
```

- [ ] **Step 2: Commit**

```bash
git add .env.test
git commit -m "chore: add test environment configuration"
```

---

## Task 15: CI/CD Configuration

**Files:**
- Create: `.github/workflows/e2e-tests.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/e2e-tests.yml`:
```yaml
name: E2E Tests

on:
  push:
    branches: [main, cj/scratch]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Install Playwright
        run: |
          npm install -g playwright-cli
          playwright-cli install chromium

      - name: Build packages
        run: |
          cd packages/gamekit && bun run build
          cd ../gamekit-server && bun run build

      - name: Run E2E tests
        run: bun test:e2e
        env:
          TEST_MODE: true

      - name: Upload test artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-artifacts
          path: test-artifacts/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e-tests.yml
git commit -m "ci: add E2E test workflow"
```

---

## Task 16: Verify End-to-End

**Files:**
- None (verification only)

- [ ] **Step 1: Run all E2E tests**

```bash
bun test:e2e
```

Expected: Tests run and complete (check for failures to debug)

- [ ] **Step 2: Check test artifacts on failure**

If tests failed:
```bash
ls -la test-artifacts/
```

Expected: Directory contains timestamped failure captures

- [ ] **Step 3: Verify server test endpoints**

Start server manually:
```bash
TEST_MODE=true node examples/pong/server.js
```

In another terminal:
```bash
curl http://localhost:3000/test/rooms
```

Expected: JSON response with `{ "rooms": [] }`

- [ ] **Step 4: Final verification checklist**

Verify:
- [ ] Client test API works (`window.game.getTestAPI()`)
- [ ] Server test endpoints respond
- [ ] Port finder handles conflicts
- [ ] Test harness spawns browsers
- [ ] Tests capture failures
- [ ] CI workflow is valid

- [ ] **Step 5: Commit verification notes**

```bash
git add -A
git commit -m "test: verify end-to-end testing infrastructure"
```

---

## Self-Review Checklist

**Spec Coverage:**
- ✅ Phase 1: Client Instrumentation (Tasks 3-5)
- ✅ Phase 2: Server Test Endpoints (Tasks 6-9)
- ✅ Phase 3: Test Harness & Utilities (Tasks 10-12)
- ✅ Phase 4: Test Suite (Task 13)
- ✅ Phase 5: Documentation & Polish (Tasks 14-15)
- ✅ Port configuration (Task 2, integrated in Task 10)
- ✅ Failure debugging (Task 12, used in Task 13)

**Placeholders:**
- No TBD, TODO, or "implement later" statements
- All code blocks contain complete implementations
- All commands have expected output
- All types and interfaces fully defined

**Type Consistency:**
- `HarnessInfo` interface used consistently
- `SpriteState` interface matches across files
- `MessageRecord` type defined and used
- All async/await patterns consistent

**Missing from Spec:**
- Gameplay tests (mentioned in spec but not critical path)
- Network reliability tests (mentioned in spec but not critical path)
- README documentation (mentioned in Phase 5 but lower priority)

These can be added in follow-up tasks after core infrastructure is validated.
