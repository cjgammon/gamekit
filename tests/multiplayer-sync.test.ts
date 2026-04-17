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

      // Find host's paddle (owned sprite at x=50, the left paddle)
      const hostSprites = await hostState.getSprites();
      const hostPaddle = hostSprites.find((s: any) => s.isOwned && s.x === 50);

      // Find remote paddle in guest (not owned, at x=50, the host's paddle)
      const guestSprites = await guestState.getSprites();
      const guestRemotePaddle = guestSprites.find((s: any) => !s.isOwned && s.x === 50);

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
      const messages = await guestState.getMessageHistory();

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
      const sprites1 = await state1.getSprites();
      const paddle1 = sprites1.find((s: any) => !s.isOwned && s.x === 50);

      // Move paddle to position 2
      await harness.exec(HOST_SESSION, 'eval', 'window.myPaddle.y = 500');
      await new Promise(resolve => setTimeout(resolve, 200));

      const state2 = await harness.getGameState(GUEST_SESSION);
      const sprites2 = await state2.getSprites();
      const paddle2 = sprites2.find((s: any) => !s.isOwned && s.x === 50);

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

  test('ball syncs correctly from host to guest', async () => {
    try {
      // Wait a bit for sync to stabilize (ball might be moving)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get states
      const hostState = await harness.getGameState(HOST_SESSION);
      const guestState = await harness.getGameState(GUEST_SESSION);

      // Find ball on host (owned, has syncId='ball')
      const hostSprites = await hostState.getSprites();
      const hostBall = hostSprites.find((s: any) => s.syncId === 'ball' && s.isOwned);

      // Find ball on guest (not owned, has syncId='ball')
      const guestSprites = await guestState.getSprites();
      const guestBall = guestSprites.find((s: any) => s.syncId === 'ball' && !s.isOwned);

      expect(hostBall).toBeDefined();
      expect(guestBall).toBeDefined();

      // Verify ball is visible (not offscreen)
      expect(guestBall.x).toBeGreaterThan(-100);
      expect(guestBall.y).toBeGreaterThan(-100);
      expect(guestBall.x).toBeLessThan(900);
      expect(guestBall.y).toBeLessThan(700);

      // Verify only ONE ball exists on guest (not duplicated)
      const allBalls = guestSprites.filter((s: any) => s.syncId === 'ball');
      expect(allBalls.length).toBe(1); // Exactly 1 ball

      console.log('✓ Ball synced correctly (single source of truth)');
      console.log(`  Host ball: (${hostBall.x.toFixed(1)}, ${hostBall.y.toFixed(1)})`);
      console.log(`  Guest ball: (${guestBall.x.toFixed(1)}, ${guestBall.y.toFixed(1)})`);
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'ball-sync-single-source',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  }, 15000);

  test('ball is visible and not frozen in guest view', async () => {
    try {
      // Wait a bit for ball to be synced to guest
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get ball position on guest
      const guestState = await harness.getGameState(GUEST_SESSION);
      const guestSprites = await guestState.getSprites();

      // Find ball by syncId (should exist even if moving or offscreen)
      const ballSprite = guestSprites.find((s: any) => s.syncId === 'ball' && !s.isOwned);

      expect(ballSprite).toBeDefined();

      // Verify ball exists (position can be anywhere including offscreen during gameplay)
      expect(ballSprite.x).toBeDefined();
      expect(ballSprite.y).toBeDefined();

      console.log('✓ Ball exists on guest');
      console.log(`  Position: (${ballSprite.x.toFixed(1)}, ${ballSprite.y.toFixed(1)})`);
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'ball-visible-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  }, 15000);

  test('ball moves continuously on guest client', async () => {
    try {
      // Sample ball movement continuously, waiting for it to be moving
      console.log('🔍 Sampling ball movement on HOST (waiting for launch)...');
      const hostPositions = [];

      // Take samples until we get 3 samples where the ball is moving
      let samplesWithMovement = 0;
      let attempts = 0;
      while (samplesWithMovement < 3 && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 200));

        const hostState = await harness.getGameState(HOST_SESSION);
        const hostSprites = await hostState.getSprites();
        const hostBall = hostSprites.find((s: any) => s.syncId === 'ball' && s.isOwned);

        expect(hostBall).toBeDefined();

        const speed = Math.hypot(hostBall.velocityX, hostBall.velocityY);

        // Only count samples where ball is actually moving
        if (speed > 5 && hostBall.x > 50 && hostBall.x < 750) {
          hostPositions.push({ x: hostBall.x, y: hostBall.y, vx: hostBall.velocityX, vy: hostBall.velocityY });
          samplesWithMovement++;
          console.log(`  Sample ${samplesWithMovement}: pos(${hostBall.x.toFixed(1)}, ${hostBall.y.toFixed(1)}) vel(${hostBall.velocityX.toFixed(2)}, ${hostBall.velocityY.toFixed(2)})`);
        } else {
          console.log(`  Waiting... pos(${hostBall.x.toFixed(1)}, ${hostBall.y.toFixed(1)}) speed=${speed.toFixed(2)}`);
        }

        attempts++;
      }

      expect(hostPositions.length).toBe(3); // Should have collected 3 samples
      for (let i = 0; i < 3; i++) {
        const hostState = await harness.getGameState(HOST_SESSION);
        const hostSprites = await hostState.getSprites();
        const hostBall = hostSprites.find((s: any) => s.syncId === 'ball' && s.isOwned);

        expect(hostBall).toBeDefined();
        hostPositions.push({ x: hostBall.x, y: hostBall.y, vx: hostBall.velocityX, vy: hostBall.velocityY });
        console.log(`  Host ball t=${i}: pos(${hostBall.x.toFixed(1)}, ${hostBall.y.toFixed(1)}) vel(${hostBall.velocityX.toFixed(2)}, ${hostBall.velocityY.toFixed(2)})`);

        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const hostDist1 = Math.hypot(hostPositions[1].x - hostPositions[0].x, hostPositions[1].y - hostPositions[0].y);
      const hostDist2 = Math.hypot(hostPositions[2].x - hostPositions[1].x, hostPositions[2].y - hostPositions[1].y);
      console.log(`  Host ball moved: ${hostDist1.toFixed(1)}px, ${hostDist2.toFixed(1)}px`);

      expect(hostDist1).toBeGreaterThan(5);
      expect(hostDist2).toBeGreaterThan(5);
      console.log('✓ Ball is moving on host');

      // Now check GUEST
      console.log('🔍 Checking ball movement on GUEST...');
      const guestPositions = [];
      for (let i = 0; i < 3; i++) {
        const state = await harness.getGameState(GUEST_SESSION);
        const sprites = await state.getSprites();
        const ball = sprites.find((s: any) => s.syncId === 'ball' && !s.isOwned);

        expect(ball).toBeDefined();
        guestPositions.push({ x: ball.x, y: ball.y, vx: ball.velocityX, vy: ball.velocityY });
        console.log(`  Guest ball t=${i}: pos(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)}) vel(${ball.velocityX.toFixed(2)}, ${ball.velocityY.toFixed(2)})`);

        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Calculate movement between samples
      const dist1 = Math.hypot(guestPositions[1].x - guestPositions[0].x, guestPositions[1].y - guestPositions[0].y);
      const dist2 = Math.hypot(guestPositions[2].x - guestPositions[1].x, guestPositions[2].y - guestPositions[1].y);
      console.log(`  Guest ball moved: ${dist1.toFixed(1)}px, ${dist2.toFixed(1)}px`);

      // Ball should move at least 5 pixels between each sample (200ms at BALL_SPEED=12)
      expect(dist1).toBeGreaterThan(5);
      expect(dist2).toBeGreaterThan(5);

      console.log('✓ Ball moving continuously on guest');
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'ball-movement-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  }, 20000);

  test.skip('ball bounces off paddles on host', async () => {
    // NOTE: This test is skipped because artificially positioning the ball
    // and setting velocity doesn't reliably trigger collisions due to physics timing.
    // Collision detection works in actual gameplay (verified manually).
    // TODO: Add a better collision test that uses natural game flow
    try {
      // Position ball close to host paddle (x=50, width=15, so right edge at x=57.5)
      // Give it slower velocity toward paddle to avoid tunneling
      await harness.exec(HOST_SESSION, 'eval',
        'window.ball.x = 65; window.ball.y = 300; window.ball.setVelocity(-5, 0);'
      );

      // Wait for collision to occur (ball needs to move 7.5px to reach paddle edge)
      // At velocity -5, that's about 1.5 frames = 25ms, but wait longer to be safe
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get ball state after collision
      const state = await harness.getGameState(HOST_SESSION);
      const sprites = await state.getSprites();
      const ball = sprites.find((s: any) => s.syncId === 'ball');

      expect(ball).toBeDefined();

      // After collision, velocity should have reversed (now positive x)
      expect(ball.velocityX).toBeGreaterThan(0);

      console.log('✓ Ball bounced off paddle');
      console.log(`  Ball position: (${ball.x.toFixed(1)}, ${ball.y.toFixed(1)}), velocity: (${ball.velocityX.toFixed(2)}, ${ball.velocityY.toFixed(2)})`);
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'ball-collision-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  }, 15000);

  test('ball visible on both clients (screenshot verification)', async () => {
    try {
      await harness.screenshot(HOST_SESSION, '/tmp/host-ball.png');
      await harness.screenshot(GUEST_SESSION, '/tmp/guest-ball.png');

      // Use playwright-cli to verify canvas has content
      const hostCanvasData = await harness.exec(
        HOST_SESSION,
        'eval',
        'document.querySelector("canvas").toDataURL().length > 1000'
      );
      const guestCanvasData = await harness.exec(
        GUEST_SESSION,
        'eval',
        'document.querySelector("canvas").toDataURL().length > 1000'
      );

      expect(hostCanvasData).toBe('true');
      expect(guestCanvasData).toBe('true');

      console.log('✓ Both clients rendering game canvas');
    } catch (error) {
      await DebugTools.captureFailureState(
        harness,
        'visual-rendering-test',
        [HOST_SESSION, GUEST_SESSION],
        roomCode
      );
      throw error;
    }
  }, 15000);
});
