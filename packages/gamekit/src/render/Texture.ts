/**
 * Sprite-sheet metadata and frame→UV resolution — the "texture atlas" math.
 *
 * Pure data: pixel dimensions plus an optional uniform frame grid. Given a
 * frame index (and flip flags) it produces a UV offset + scale in [0,1] texture
 * space, which the batcher copies into per-instance data. No GPU handle lives
 * here yet; the renderer pairs this metadata with its `GPUTexture` separately,
 * so this file stays dependency- and DOM-free and is unit-testable headless.
 *
 * Frames are laid out left-to-right, top-to-bottom. A flip is encoded as a
 * negative scale with the offset moved to the opposite edge, so the shader can
 * stay flip-agnostic: `uv = offset + corner * scale`.
 */
export interface FrameUV {
  /** UV of the frame's origin corner (already flip-adjusted). */
  u: number;
  v: number;
  /** UV span across the frame; negative when flipped on that axis. */
  uScale: number;
  vScale: number;
}

export class Texture {
  /** Source texture size, in pixels. */
  readonly width: number;
  readonly height: number;
  /** Frame size, in pixels (falls back to the full texture when unset). */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Grid dimensions derived from the frame size. */
  readonly framesPerRow: number;
  readonly rows: number;
  readonly frameCount: number;

  constructor(width: number, height: number, frameWidth = 0, frameHeight = 0) {
    this.width = width;
    this.height = height;
    // A zero frame size means "one frame == the whole texture".
    this.frameWidth = frameWidth || width;
    this.frameHeight = frameHeight || height;
    this.framesPerRow = Math.max(1, Math.floor(width / this.frameWidth));
    this.rows = Math.max(1, Math.floor(height / this.frameHeight));
    this.frameCount = this.framesPerRow * this.rows;
  }

  /**
   * Resolve `frame` (wrapped into range) plus flip flags into a {@link FrameUV}.
   * Fills and returns `out` so the caller can reuse one instance.
   */
  frameUV(
    frame: number,
    flipX: boolean,
    flipY: boolean,
    out: FrameUV,
  ): FrameUV {
    const wrapped = ((frame % this.frameCount) + this.frameCount) % this.frameCount;
    const col = wrapped % this.framesPerRow;
    const row = Math.floor(wrapped / this.framesPerRow);

    const du = this.frameWidth / this.width;
    const dv = this.frameHeight / this.height;
    const u0 = (col * this.frameWidth) / this.width;
    const v0 = (row * this.frameHeight) / this.height;

    if (flipX) {
      out.u = u0 + du;
      out.uScale = -du;
    } else {
      out.u = u0;
      out.uScale = du;
    }
    if (flipY) {
      out.v = v0 + dv;
      out.vScale = -dv;
    } else {
      out.v = v0;
      out.vScale = dv;
    }
    return out;
  }
}
