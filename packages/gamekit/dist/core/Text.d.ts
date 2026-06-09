import { BitmapFont } from "./BitmapFont.js";
import { Entity } from "./Entity.js";
export type TextAlign = "left" | "center" | "right";
/** Per-glyph layout callback: frame index + world-space top-left + size. */
export type GlyphVisitor = (frame: number, worldX: number, worldY: number, width: number, height: number) => void;
/**
 * A line (or block) of text rendered from a {@link BitmapFont}. Lays out one
 * quad per glyph; the renderer resolves the font texture and draws them. Honors
 * `\n` for multiple lines and `align` for left/center/right within the block.
 *
 * Pure layout (no DOM): {@link forEachGlyph} produces world-space glyph quads,
 * and {@link measure} sizes the entity's bounds. Drawn in world space — for a
 * fixed HUD, position it relative to the camera each frame.
 */
export declare class Text extends Entity {
    font: BitmapFont;
    /** Glyph tint (0xRRGGBB). */
    tint: number;
    /** 0..1 opacity. */
    alpha: number;
    /** Uniform scale applied to glyph size and advances. */
    scale: number;
    align: TextAlign;
    private _text;
    constructor(font: BitmapFont, text?: string, x?: number, y?: number);
    get text(): string;
    set text(value: string);
    /** Fluent setter. */
    setText(value: string): this;
    /** Recompute `width`/`height` from the current text, font, and scale. */
    measure(): this;
    /**
     * Visit every drawable glyph (whitespace is advanced over, not emitted),
     * passing its frame index and world-space quad. Used by the renderer.
     */
    forEachGlyph(visit: GlyphVisitor): void;
    /** Advance width of one line, scaled (the pen distance across it). */
    private _lineWidth;
}
