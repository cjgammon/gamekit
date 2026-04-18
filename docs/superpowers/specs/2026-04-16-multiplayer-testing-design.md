# Multiplayer Testing Infrastructure Design

**Date:** 2026-04-16
**Status:** PENDING
**Author:** AI Assistant

## Overview

Comprehensive automated E2E testing infrastructure for GameKit's multiplayer sprite synchronization. Designed to catch sync issues (like "frozen sprites") by verifying state consistency across host client, server, and guest client.

## Problem Statement

GameKit's multiplayer game engine experiences intermittent synchronization issues:
- **Frozen sprites**: Remote paddles/balls appear frozen in guest windows even though host is updating them
- **No visibility**: Currently no automated way to detect these issues
- **Manual debugging is slow**: Requires opening multiple browsers and visually inspecting

The root cause could be anywhere in the sync pipeline:
1. Host client not sending updates
2. Server not receiving/relaying messages
3. Guest client not receiving messages
4. Guest client receiving but not rendering

## Solution: Three-Layer Testing Architecture

### Layer 1: Client Instrumentation
- Expose internal game state via `window.__gamekit_test__` API
- Track sprite positions, velocities, network messages
- Zero performance impact in production (test mode only)

### Layer 2: Server Test Endpoints
- Add `/test/*` HTTP endpoints (test mode only)
- Expose room state, sprite sync history, message logs
- Enables three-way verification: host → server → guest

### Layer 3: Test Orchestration
- Playwright-based E2E tests with isolated browser sessions
- Automatic port allocation (handles port conflicts)
- Rich failure capture: screenshots + logs + state dumps

## Architecture

### Test Flow Pattern

```
1. Test starts server (dynamic port allocation)
2. Test starts Vite dev server (dynamic port)
3. Spawn host browser → create room → get room code
4. Spawn guest browser → join room with code
5. Execute test scenario (move paddle, etc.)
6. Assert: host client state ≈ server state ≈ guest client state
7. On failure: capture screenshots, logs, state dumps
8. Cleanup: close browsers, stop servers
```

### Components

#### 1. Client Test API (packages/gamekit/src/game.ts)

```typescript
interface GameTestAPI {
  getSprites(): Array<{
    syncId: string;
    x: number;
    y: number;
    angle: number;
    velocityX: number;
    velocityY: number;
    isOwned: boolean;
  }>;

  getNetworkState(): {
    isConnected: boolean;
    roomCode: string | null;
    player: { name: string; isHost: boolean } | null;
  };

  getMessageHistory(): Array<{
    timestamp: number;
    event: string;
    data: any;
  }>;

  getFrameCount(): number;
}
```

**Implementation:**
- Add `getTestAPI()` method to `Game` class
- Add message history tracking to `Network` class
- Add frame counter to game loop

#### 2. Server Test Endpoints (packages/gamekit-server/src/test-endpoints.ts)

```
GET  /test/rooms
     → List all active rooms

GET  /test/rooms/:code/state
     → Full room state (players, sprites, last sync timestamp)

GET  /test/rooms/:code/messages
     → Network message history for room
```

**Implementation:**
- New `TestEndpoints` class that wraps HTTP server
- Enabled only when `testMode: true` in server options
- Access to `RoomManager` for state inspection

#### 3. Test Harness (tests/helpers/multiplayer-harness.ts)

```typescript
class MultiplayerTestHarness {
  // Dynamic port allocation
  async startServer(): Promise<HarnessInfo>;

  // Browser session management
  async createHost(sessionId: string, playerName: string): Promise<string>;
  async createGuest(sessionId: string, roomCode: string, playerName: string): Promise<void>;

  // State extraction
  async getGameState(sessionId: string): Promise<GameState>;
  async getServerState(roomCode: string): Promise<ServerState>;

  // Failure debugging
  async screenshot(sessionId: string, filename: string): Promise<void>;

  // Cleanup
  async cleanup(): Promise<void>;
}
```

**Key features:**
- Automatic port allocation with `findAvailablePort()`
- Starts both GameKit server and Vite dev server
- Manages isolated Playwright sessions via `PILOT_SESSION_ID`
- Returns `HarnessInfo` with actual allocated ports

#### 4. Assertion Helpers (tests/helpers/assertions.ts)

```typescript
class SyncAssertions {
  static assertSpritePositionMatches(sprite1, sprite2, tolerance);
  static assertSpriteExists(sprites, syncId);
  static assertMessageReceived(messageHistory, eventName, withinMs);
}
```

#### 5. Debug Tools (tests/helpers/debug-tools.ts)

```typescript
class DebugTools {
  static async captureFailureState(harness, testName, sessions, roomCode);
  static diffStates(state1, state2, label1, label2): string;
}
```

## Test Coverage

### Core Sync Tests (tests/multiplayer-sync.test.ts)
- Paddle position syncs from host to guest
- Guest receives `spriteSync` messages
- Ball syncs from host to guest
- **Frozen sprite detection** (catches the main bug)

### Gameplay Tests (tests/multiplayer-gameplay.test.ts)
- Game starts when both players join
- Score updates sync to both players
- Collision detection works on host
- Win condition triggers on both clients

### Network Reliability Tests (tests/multiplayer-network.test.ts)
- Room creation succeeds
- Guest can join existing room
- Guest receives `playerJoined` event
- Disconnection handled gracefully

## Implementation Plan

### Phase 1: Client Instrumentation
1. Add `getTestAPI()` to `Game` class
2. Add message history to `Network` class
3. Add frame counter to game loop
4. Add test mode flag (`window.__GAMEKIT_TEST_MODE__`)

### Phase 2: Server Test Endpoints
1. Add `testMode` to `ServerOptions` interface
2. Create `TestEndpoints` class
3. Add message history to `Room` interface
4. Wire up endpoints in `GameKitServer` constructor

### Phase 3: Test Harness & Utilities
1. Create `port-finder.ts` utility
2. Create `MultiplayerTestHarness` class
3. Create `SyncAssertions` helper
4. Create `DebugTools` helper

### Phase 4: Test Suite
1. Write core sync tests
2. Write gameplay tests
3. Write network reliability tests
4. Add CI/CD configuration

### Phase 5: Documentation & Polish
1. Update README with testing guide
2. Add example test for contributors
3. Configure test artifacts cleanup
4. Add pre-commit hooks for tests

## Port Configuration

Tests use dynamic port allocation to avoid conflicts:

```typescript
const harness = new MultiplayerTestHarness({
  preferredServerPort: 3000,  // Will use 3001, 3002, etc. if taken
  preferredAppPort: 5173,     // Will use 5174, 5175, etc. if taken
});

const info = await harness.startServer();
console.log(`Running on: ${info.serverUrl} / ${info.appUrl}`);
```

**Port finder algorithm:**
1. Check if preferred port is available
2. If not, try port+1, port+2, etc. (max 100 attempts)
3. Return first available port
4. Report to console if default port was unavailable

## Failure Debugging Workflow

When a test fails:

1. **Screenshots** captured from all browser sessions
2. **State dumps** captured in JSON:
   - Host client state (sprites, network, messages)
   - Guest client state (sprites, network, messages)
   - Server state (room, players, sprite sync history)
3. **Diff report** generated showing state mismatches
4. All artifacts saved to `test-artifacts/[test-name]-[timestamp]/`

Example failure output:
```
❌ Test failed: frozen sprite detection

Sprite position mismatch:
  Host paddle: (50, 500)
  Guest paddle: (50, 100)
  Delta: (0, 400) > tolerance 5

📸 Failure state captured: test-artifacts/frozen-sprite-1713312000/
  - test-host.png
  - test-guest.png
  - state-dump.json
```

## Testing Commands

```bash
# Run all E2E tests
bun test:e2e

# Run with watch mode
bun test:e2e:watch

# Run specific test
bun test tests/multiplayer-sync.test.ts

# Debug mode (stop on first failure)
bun test:debug

# With custom ports
TEST_SERVER_PORT=3001 TEST_APP_PORT=5174 bun test:e2e
```

## File Structure

```
gamekit/
├── packages/
│   ├── gamekit/
│   │   └── src/
│   │       ├── game.ts           (add getTestAPI)
│   │       └── network.ts        (add message history)
│   └── gamekit-server/
│       └── src/
│           ├── server.ts         (add test mode)
│           ├── test-endpoints.ts (NEW)
│           └── types.ts          (add testMode, messageHistory)
├── tests/
│   ├── helpers/
│   │   ├── multiplayer-harness.ts  (NEW)
│   │   ├── assertions.ts           (NEW)
│   │   ├── debug-tools.ts          (NEW)
│   │   └── port-finder.ts          (NEW)
│   ├── multiplayer-sync.test.ts    (NEW)
│   ├── multiplayer-gameplay.test.ts (NEW)
│   └── multiplayer-network.test.ts  (NEW)
├── test-artifacts/                   (NEW, gitignored)
├── .env.test                         (NEW)
└── .github/
    └── workflows/
        └── e2e-tests.yml             (NEW)
```

## Environment Variables

```bash
# .env.test
TEST_MODE=true
TEST_SERVER_PORT=3000
TEST_APP_PORT=5173
TEST_TIMEOUT=30000
SCREENSHOT_DIR=./test-artifacts
```

## CI/CD Integration

GitHub Actions workflow runs on:
- Push to `main` or `cj/scratch`
- Pull requests to `main`

Steps:
1. Setup Bun + Playwright
2. Install dependencies
3. Build packages
4. Run E2E tests
5. Upload artifacts on failure

## Success Criteria

1. **Frozen sprite bug is caught**: Test fails when remote sprites stop updating
2. **Root cause is clear**: Failure output shows exactly which layer broke (client/server/network)
3. **Fast iteration**: Tests complete in < 2 minutes
4. **Easy to debug**: Screenshots + state dumps make issues obvious
5. **CI-friendly**: Tests run reliably in GitHub Actions
6. **Port-flexible**: Tests work regardless of what ports are in use

## Future Enhancements

1. **Performance testing**: Measure sync latency, frame drops
2. **Stress testing**: 4+ players, high message volume
3. **Network simulation**: Inject lag, packet loss
4. **Visual regression**: Compare screenshots frame-by-frame
5. **Server validation mode**: Server runs physics simulation and validates client state

## Security Considerations

- Test endpoints only enabled when `testMode: true`
- Never enable test mode in production
- Test endpoints expose room state but require room code
- No authentication bypass or privilege escalation risk

## Dependencies

- **bun**: Test runner
- **playwright-cli**: Browser automation with session isolation
- **Node.js net module**: Port availability checking
- **fetch API**: Server endpoint testing

## Performance Impact

- **Client**: Zero impact in production (test API gated by flag)
- **Server**: Test endpoints add ~1ms response time (only in test mode)
- **Tests**: ~30-60 seconds per test suite

## Maintenance

- Update tests when adding new game features
- Archive old test artifacts after 7 days
- Review test coverage monthly
- Update CI timeouts if tests slow down

## Related Documentation

- [Playwright CLI Documentation](playwright-cli.md)
- [GameKit Network Protocol](network-protocol.md)
- [Contributing Guide](CONTRIBUTING.md)
