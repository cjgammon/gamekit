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
