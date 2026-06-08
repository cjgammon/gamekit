export class Texture {
    constructor(width, height, frameWidth = 0, frameHeight = 0) {
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
    frameUV(frame, flipX, flipY, out) {
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
        }
        else {
            out.u = u0;
            out.uScale = du;
        }
        if (flipY) {
            out.v = v0 + dv;
            out.vScale = -dv;
        }
        else {
            out.v = v0;
            out.vScale = dv;
        }
        return out;
    }
}
