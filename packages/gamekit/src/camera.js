// ============================================================
//  camera.js — moves the view to follow a sprite
//
//  Instead of moving the player around the world, the camera
//  moves the whole stage in the opposite direction. This makes
//  it look like the camera is following the player.
// ============================================================

export class Camera {

  constructor(stage, viewWidth, viewHeight) {
    this._stage      = stage;
    this._viewWidth  = viewWidth;
    this._viewHeight = viewHeight;

    this._target     = null;   // the sprite to follow
    this._lerpSpeed  = 0.1;    // 0 = instant, 1 = snappy, 0.1 = smooth

    // optional world bounds (camera won't go past these)
    this._bounds = null;
  }

  // ------------------------------------------------------------------
  //  follow(sprite, options)
  //
  //  Make the camera follow a sprite.
  //
  //  options = {
  //    lerp:   0.1,    // smoothness (0.05 = very smooth, 0.3 = snappy)
  //    bounds: {       // clamp camera to world bounds
  //      x: 0, y: 0,
  //      width: 3200, height: 600
  //    }
  //  }
  // ------------------------------------------------------------------
  follow(sprite, options = {}) {
    this._target    = sprite;
    this._lerpSpeed = options.lerp   ?? 0.1;
    this._bounds    = options.bounds ?? null;
  }

  // ------------------------------------------------------------------
  //  update() — called every frame by the game loop
  // ------------------------------------------------------------------
  update() {
    if (!this._target || this._target.destroyed) return;

    // where we want the camera to be (target centered on screen)
    const targetX = -this._target.x + this._viewWidth  / 2;
    const targetY = -this._target.y + this._viewHeight / 2;

    // smooth lerp toward target position
    this._stage.x += (targetX - this._stage.x) * this._lerpSpeed;
    this._stage.y += (targetY - this._stage.y) * this._lerpSpeed;

    // clamp to world bounds if set
    if (this._bounds) {
      const minX = -(this._bounds.width  - this._viewWidth);
      const minY = -(this._bounds.height - this._viewHeight);

      this._stage.x = Math.max(minX, Math.min(0, this._stage.x));
      this._stage.y = Math.max(minY, Math.min(0, this._stage.y));
    }
  }

  // ------------------------------------------------------------------
  //  shake(intensity, duration) — screen shake effect
  //  Great for explosions, taking damage, etc.
  // ------------------------------------------------------------------
  shake(intensity = 8, duration = 300) {
    const startTime = performance.now();
    const baseX     = this._stage.x;
    const baseY     = this._stage.y;

    const doShake = () => {
      const elapsed  = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this._stage.x = baseX;
        this._stage.y = baseY;
        return;
      }

      const remaining = 1 - progress;
      this._stage.x   = baseX + (Math.random() - 0.5) * intensity * 2 * remaining;
      this._stage.y   = baseY + (Math.random() - 0.5) * intensity * 2 * remaining;

      requestAnimationFrame(doShake);
    };

    requestAnimationFrame(doShake);
  }
}
