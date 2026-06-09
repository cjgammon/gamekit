import { Entity } from "./Entity.js";
/** Per-tile visit callback: grid coords, tile value, and world-space top-left. */
export type TileVisitor = (col: number, row: number, index: number, worldX: number, worldY: number) => void;
/**
 * A grid of tiles backed by a flat typed array — the level geometry primitive.
 * Tile value `0` is empty; non-zero values index into a tileset (frame
 * `value - 1`). The map's own `x`/`y` place its top-left in the world.
 *
 * Solid tiles collide with entities far more cheaply than one entity per tile:
 * {@link collide} only tests the tiles overlapping the entity's AABB and
 * separates it out as an immovable body. By default every non-zero tile is
 * solid; override per index with {@link setTileCollision}.
 *
 * Pure data + math (no DOM): rendering is handled by the renderer, which walks
 * the visible tiles via {@link forEachTileIn}.
 */
export declare class Tilemap extends Entity {
    readonly cols: number;
    readonly rows: number;
    readonly tileWidth: number;
    readonly tileHeight: number;
    /** Flat row-major tile values (length `cols * rows`). */
    readonly data: Uint16Array;
    /** Tileset texture id the renderer resolves (empty → solid white quads). */
    tilesetId: string;
    /** Multiplicative tint for all tiles (0xRRGGBB). */
    tint: number;
    /** Per-index solidity overrides; absent indices use the default rule. */
    private readonly _solid;
    private readonly _tileAABB;
    constructor(cols: number, rows: number, tileWidth: number, tileHeight: number, data?: ArrayLike<number>);
    /** True if `(col, row)` is inside the grid. */
    inBounds(col: number, row: number): boolean;
    /** Tile value at `(col, row)`, or 0 outside the grid. */
    getTile(col: number, row: number): number;
    /** Set the tile value at `(col, row)` (no-op outside the grid). */
    setTile(col: number, row: number, value: number): void;
    /** Fill the whole grid with `value`. */
    fill(value: number): void;
    /** Column containing world x. */
    worldToCol(worldX: number): number;
    /** Row containing world y. */
    worldToRow(worldY: number): number;
    /** Tile value at a world point (0 if empty/outside). */
    getTileAtWorld(worldX: number, worldY: number): number;
    /** Override whether a given tile index is solid. */
    setTileCollision(index: number, solid: boolean): void;
    /** Whether a tile value collides. Default: any non-zero tile is solid. */
    isSolid(index: number): boolean;
    /**
     * Separate `entity` out of any solid tiles it overlaps (tiles are immovable,
     * so the entity absorbs the full correction and has its velocity zeroed on the
     * contact axis). Only the tiles under the entity's AABB are tested.
     *
     * @returns true if the entity touched any solid tile.
     */
    collide(entity: Entity): boolean;
    /**
     * Visit every non-empty tile whose cell intersects the world rectangle
     * `[minX, maxX] × [minY, maxY]` — the renderer uses this to draw only the
     * tiles in view.
     */
    forEachTileIn(minX: number, minY: number, maxX: number, maxY: number, visit: TileVisitor): void;
}
