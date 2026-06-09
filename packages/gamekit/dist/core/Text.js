import { Entity } from "./Entity.js";
/**
 * A line (or block) of text rendered from a {@link BitmapFont}. Lays out one
 * quad per glyph; the renderer resolves the font texture and draws them. Honors
 * `\n` for multiple lines and `align` for left/center/right within the block.
 *
 * Pure layout (no DOM): {@link forEachGlyph} produces world-space glyph quads,
 * and {@link measure} sizes the entity's bounds. Drawn in world space — for a
 * fixed HUD, position it relative to the camera each frame.
 */
export class Text extends Entity {
    constructor(font, text = "", x = 0, y = 0) {
        super(x, y);
        /** Glyph tint (0xRRGGBB). */
        this.tint = 0xffffff;
        /** 0..1 opacity. */
        this.alpha = 1;
        /** Uniform scale applied to glyph size and advances. */
        this.scale = 1;
        this.align = "left";
        this._text = "";
        this.font = font;
        this.interpolate = false; // text is positioned directly, not integrated
        this.text = text;
    }
    get text() {
        return this._text;
    }
    set text(value) {
        this._text = value;
        this.measure();
    }
    /** Fluent setter. */
    setText(value) {
        this.text = value;
        return this;
    }
    /** Recompute `width`/`height` from the current text, font, and scale. */
    measure() {
        const lines = this._text.split("\n");
        let max = 0;
        for (const line of lines)
            max = Math.max(max, this._lineWidth(line));
        this.width = max;
        this.height = lines.length * this.font.lineHeight * this.scale;
        return this;
    }
    /**
     * Visit every drawable glyph (whitespace is advanced over, not emitted),
     * passing its frame index and world-space quad. Used by the renderer.
     */
    forEachGlyph(visit) {
        const font = this.font;
        const s = this.scale;
        const gw = font.charWidth * s;
        const gh = font.charHeight * s;
        const lineH = font.lineHeight * s;
        const blockW = this.width;
        const lines = this._text.split("\n");
        for (let li = 0; li < lines.length; li++) {
            const line = lines[li];
            const lineW = this._lineWidth(line);
            const offsetX = this.align === "left"
                ? 0
                : this.align === "center"
                    ? (blockW - lineW) / 2
                    : blockW - lineW;
            let penX = this.x + offsetX;
            const penY = this.y + li * lineH;
            for (let i = 0; i < line.length; i++) {
                const code = line.charCodeAt(i);
                if (code !== 32) {
                    const frame = font.frameFor(code);
                    if (frame >= 0)
                        visit(frame, penX, penY, gw, gh);
                }
                penX += (font.advanceFor(code) + font.letterSpacing) * s;
            }
        }
    }
    /** Advance width of one line, scaled (the pen distance across it). */
    _lineWidth(line) {
        const font = this.font;
        let w = 0;
        for (let i = 0; i < line.length; i++) {
            w += font.advanceFor(line.charCodeAt(i)) + font.letterSpacing;
        }
        return w * this.scale;
    }
}
