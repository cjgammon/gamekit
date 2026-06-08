/** Layout metrics for a {@link BitmapFont}. */
export interface BitmapFontOptions {
  /** Glyph cell size in the sheet, in pixels. */
  charWidth: number;
  charHeight: number;
  /** Char code of the first glyph (frame 0). Default 32 (space). */
  firstChar?: number;
  /** Number of glyph frames in the sheet. Default 95 (ASCII 32–126). */
  charCount?: number;
  /** Horizontal advance per glyph. Default `charWidth` (monospaced). */
  advance?: number;
  /** Vertical advance per line. Default `charHeight`. */
  lineHeight?: number;
  /** Extra pixels between glyphs. Default 0. */
  letterSpacing?: number;
}

/**
 * A bitmap font: a glyph sprite-sheet plus layout metrics. The sheet is an
 * ordinary texture whose frames are glyphs in char-code order, so the renderer
 * resolves a glyph the same way it resolves any sprite frame (via the texture's
 * UV grid). This class only maps characters → frame indices and supplies
 * advances — pure data, no DOM, no texture handle (the renderer pairs it with
 * the GPU texture by {@link fontId}).
 *
 * Monospaced by default; call {@link setAdvance} for per-character widths.
 */
export class BitmapFont {
  /** Texture id of the glyph sheet (resolved by the renderer's asset loader). */
  fontId: string;
  readonly charWidth: number;
  readonly charHeight: number;
  readonly firstChar: number;
  readonly charCount: number;
  readonly advance: number;
  readonly lineHeight: number;
  letterSpacing: number;

  private _advances?: Map<number, number>;

  constructor(fontId: string, opts: BitmapFontOptions) {
    this.fontId = fontId;
    this.charWidth = opts.charWidth;
    this.charHeight = opts.charHeight;
    this.firstChar = opts.firstChar ?? 32;
    this.charCount = opts.charCount ?? 95;
    this.advance = opts.advance ?? opts.charWidth;
    this.lineHeight = opts.lineHeight ?? opts.charHeight;
    this.letterSpacing = opts.letterSpacing ?? 0;
  }

  /** Frame index for a char code, or -1 if the font has no glyph for it. */
  frameFor(code: number): number {
    const i = code - this.firstChar;
    return i >= 0 && i < this.charCount ? i : -1;
  }

  /** Horizontal advance for a char code (per-char override or the default). */
  advanceFor(code: number): number {
    return this._advances?.get(code) ?? this.advance;
  }

  /** Override the advance width of a single character (variable-width fonts). */
  setAdvance(char: string, advance: number): this {
    (this._advances ??= new Map()).set(char.charCodeAt(0), advance);
    return this;
  }
}
