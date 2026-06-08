import { AABB } from "../math/AABB.js";
import { Entity } from "./Entity.js";
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
export class Tilemap extends Entity {
    constructor(cols, rows, tileWidth, tileHeight, data) {
        super(0, 0);
        /** Tileset texture id the renderer resolves (empty → solid white quads). */
        this.tilesetId = "";
        /** Multiplicative tint for all tiles (0xRRGGBB). */
        this.tint = 0xffffff;
        /** Per-index solidity overrides; absent indices use the default rule. */
        this._solid = new Map();
        this._tileAABB = new AABB();
        this.cols = cols;
        this.rows = rows;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.width = cols * tileWidth;
        this.height = rows * tileHeight;
        this.data = new Uint16Array(cols * rows);
        if (data)
            this.data.set(data);
        // Tiles are authored, not integrated — don't let it move/interpolate.
        this.interpolate = false;
    }
    // ---- Grid access ----
    /** True if `(col, row)` is inside the grid. */
    inBounds(col, row) {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }
    /** Tile value at `(col, row)`, or 0 outside the grid. */
    getTile(col, row) {
        if (!this.inBounds(col, row))
            return 0;
        return this.data[row * this.cols + col];
    }
    /** Set the tile value at `(col, row)` (no-op outside the grid). */
    setTile(col, row, value) {
        if (!this.inBounds(col, row))
            return;
        this.data[row * this.cols + col] = value;
    }
    /** Fill the whole grid with `value`. */
    fill(value) {
        this.data.fill(value);
    }
    /** Column containing world x. */
    worldToCol(worldX) {
        return Math.floor((worldX - this.x) / this.tileWidth);
    }
    /** Row containing world y. */
    worldToRow(worldY) {
        return Math.floor((worldY - this.y) / this.tileHeight);
    }
    /** Tile value at a world point (0 if empty/outside). */
    getTileAtWorld(worldX, worldY) {
        return this.getTile(this.worldToCol(worldX), this.worldToRow(worldY));
    }
    // ---- Collision ----
    /** Override whether a given tile index is solid. */
    setTileCollision(index, solid) {
        this._solid.set(index, solid);
    }
    /** Whether a tile value collides. Default: any non-zero tile is solid. */
    isSolid(index) {
        const override = this._solid.get(index);
        if (override !== undefined)
            return override;
        return index !== 0;
    }
    /**
     * Separate `entity` out of any solid tiles it overlaps (tiles are immovable,
     * so the entity absorbs the full correction and has its velocity zeroed on the
     * contact axis). Only the tiles under the entity's AABB are tested.
     *
     * @returns true if the entity touched any solid tile.
     */
    collide(entity) {
        const b0 = entity.bounds;
        // Tile range under the entity (clamped to the grid).
        const minCol = Math.max(0, this.worldToCol(b0.left));
        const maxCol = Math.min(this.cols - 1, this.worldToCol(b0.right));
        const minRow = Math.max(0, this.worldToRow(b0.top));
        const maxRow = Math.min(this.rows - 1, this.worldToRow(b0.bottom));
        let hit = false;
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (!this.isSolid(this.getTile(col, row)))
                    continue;
                const tile = this._tileAABB.set(this.x + col * this.tileWidth, this.y + row * this.tileHeight, this.tileWidth, this.tileHeight);
                const eb = entity.bounds; // refetch — entity may have moved
                if (!eb.overlaps(tile))
                    continue;
                const mtv = eb.penetration(tile); // moves the entity out of the tile
                if (mtv.x === 0 && mtv.y === 0)
                    continue;
                entity.x += mtv.x;
                entity.y += mtv.y;
                if (mtv.x !== 0)
                    entity.velocity.x = 0;
                if (mtv.y !== 0)
                    entity.velocity.y = 0;
                hit = true;
            }
        }
        return hit;
    }
    // ---- Rendering support ----
    /**
     * Visit every non-empty tile whose cell intersects the world rectangle
     * `[minX, maxX] × [minY, maxY]` — the renderer uses this to draw only the
     * tiles in view.
     */
    forEachTileIn(minX, minY, maxX, maxY, visit) {
        const minCol = Math.max(0, this.worldToCol(minX));
        const maxCol = Math.min(this.cols - 1, this.worldToCol(maxX));
        const minRow = Math.max(0, this.worldToRow(minY));
        const maxRow = Math.min(this.rows - 1, this.worldToRow(maxY));
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const index = this.data[row * this.cols + col];
                if (index === 0)
                    continue;
                visit(col, row, index, this.x + col * this.tileWidth, this.y + row * this.tileHeight);
            }
        }
    }
}
