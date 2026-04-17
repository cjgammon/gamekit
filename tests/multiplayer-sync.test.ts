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
  }, 30000); // 30 second timeout for server startup and browser initialization

  afterAll(async () => {
    await harness.cleanup();
  });

  test('paddle position syncs from host to guest', async () => {
    try {
      // Host moves paddle
      await harness.exec(HOST_SESSION, 'eval', 'window.myPaddle.y = 400');

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
  }, 15000);

  test('guest receives spriteSync messages', async () => {
    try {
      // Host moves paddle
      await harness.exec(HOST_SESSION, 'eval', 'window.myPaddle.y = 200');

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
  }, 15000);

  test('frozen sprite detection - catches stuck remote sprites', async () => {
    try {
      // Move paddle to position 1
      await harness.exec(HOST_SESSION, 'eval', 'window.myPaddle.y = 100');
      await new Promise(resolve => setTimeout(resolve, 200));

      const state1 = await harness.getGameState(GUEST_SESSION);
      const sprites1 = state1.getSprites();
      const paddle1 = sprites1.find((s: any) => !s.isOwned);

      // Move paddle to position 2
      await harness.exec(HOST_SESSION, 'eval', 'window.myPaddle.y = 500');
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
  }, 15000);
});
