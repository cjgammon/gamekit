import { describe, expect, test } from "vitest";
import { BitmapFont, Text } from "../../packages/gamekit/src/index.js";

/** 8×8 monospaced font, ASCII 32–126. */
function font(): BitmapFont {
  return new BitmapFont("font", { charWidth: 8, charHeight: 8 });
}

/** Collect glyphs as [frame, x, y, w, h] for assertions. */
function glyphs(t: Text): Array<[number, number, number, number, number]> {
  const out: Array<[number, number, number, number, number]> = [];
  t.forEachGlyph((frame, x, y, w, h) => out.push([frame, x, y, w, h]));
  return out;
}

describe("BitmapFont", () => {
  test("maps char codes to frames relative to firstChar", () => {
    const f = font(); // firstChar 32
    expect(f.frameFor(" ".charCodeAt(0))).toBe(0); // 32 → 0
    expect(f.frameFor("A".charCodeAt(0))).toBe(33); // 65 → 33
    expect(f.frameFor("~".charCodeAt(0))).toBe(94); // 126 → 94
  });

  test("returns -1 for characters outside the range", () => {
    const f = font();
    expect(f.frameFor(9)).toBe(-1); // tab, below firstChar
    expect(f.frameFor(200)).toBe(-1); // beyond charCount
  });

  test("advance defaults to charWidth; per-char override applies", () => {
    const f = font();
    expect(f.advanceFor("A".charCodeAt(0))).toBe(8);
    f.setAdvance("i", 4);
    expect(f.advanceFor("i".charCodeAt(0))).toBe(4);
  });
});

describe("Text layout", () => {
  test("measures width/height from text, font, and scale", () => {
    const t = new Text(font(), "ABC"); // 3 glyphs × 8px
    expect(t.width).toBe(24);
    expect(t.height).toBe(8);
    t.scale = 2;
    t.measure();
    expect(t.width).toBe(48);
    expect(t.height).toBe(16);
  });

  test("multiline grows height and width is the longest line", () => {
    const t = new Text(font(), "AB\nLONG");
    expect(t.height).toBe(16); // 2 lines × 8
    expect(t.width).toBe(32); // "LONG" = 4 × 8
  });

  test("lays out glyphs left-to-right at the text origin", () => {
    const t = new Text(font(), "AB", 100, 50);
    expect(glyphs(t)).toEqual([
      [33, 100, 50, 8, 8], // 'A'
      [34, 108, 50, 8, 8], // 'B'
    ]);
  });

  test("advances over spaces without emitting a glyph", () => {
    const t = new Text(font(), "A B", 0, 0);
    const g = glyphs(t);
    expect(g.length).toBe(2); // space not emitted
    expect(g[0][1]).toBe(0); // 'A' at x=0
    expect(g[1][1]).toBe(16); // 'B' at x=16 (advanced past the space)
  });

  test("newline drops to the next line", () => {
    const t = new Text(font(), "A\nB", 0, 0);
    const g = glyphs(t);
    expect(g[0]).toEqual([33, 0, 0, 8, 8]); // 'A' line 0
    expect(g[1]).toEqual([34, 0, 8, 8, 8]); // 'B' line 1, y += lineHeight
  });

  test("center alignment offsets shorter lines within the block", () => {
    const t = new Text(font(), "A\nABCD", 0, 0); // block width = 32
    t.align = "center";
    const g = glyphs(t);
    // Line 0 "A" width 8 → offset (32-8)/2 = 12.
    expect(g[0][1]).toBe(12);
    // Line 1 "ABCD" fills the block → starts at 0.
    expect(g[1][1]).toBe(0);
  });

  test("right alignment pushes lines to the block's right edge", () => {
    const t = new Text(font(), "A\nABCD", 0, 0);
    t.align = "right";
    const g = glyphs(t);
    expect(g[0][1]).toBe(24); // 32 - 8
  });

  test("scale enlarges glyph quads and advances", () => {
    const t = new Text(font(), "AB", 0, 0);
    t.scale = 2;
    t.measure();
    const g = glyphs(t);
    expect(g[0]).toEqual([33, 0, 0, 16, 16]);
    expect(g[1]).toEqual([34, 16, 0, 16, 16]); // advance 8×2
  });
});
