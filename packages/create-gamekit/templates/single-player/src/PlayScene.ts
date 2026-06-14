import { Entity, Scene } from "@cjgammon/gamekit";
import type { InputManager } from "@cjgammon/gamekit/input";

const SPEED = 220; // pixels per second

/**
 * Your game lives in a Scene. `create()` builds it; `fixedUpdate()` runs the
 * game logic at a fixed rate. An Entity with a size but no texture draws as a
 * white box — so you can start without any art.
 */
export class PlayScene extends Scene {
  private player!: Entity;

  constructor(private readonly input: InputManager) {
    super();
  }

  override create(): void {
    this.player = new Entity(300, 220);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);
  }

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt); // integrates motion, advances the camera

    const i = this.input;
    const dx = (i.isDown("right") ? 1 : 0) - (i.isDown("left") ? 1 : 0);
    const dy = (i.isDown("down") ? 1 : 0) - (i.isDown("up") ? 1 : 0);
    // Normalize so diagonal movement isn't faster.
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);
  }
}
