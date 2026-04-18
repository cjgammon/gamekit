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
