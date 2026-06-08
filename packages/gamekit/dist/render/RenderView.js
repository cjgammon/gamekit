import { Group } from "../core/Group.js";
import { Sprite } from "../core/Sprite.js";
/**
 * Bridges a {@link Scene} to the renderer each frame: walks the scene's entity
 * tree in draw order, computes each drawable's interpolated transform + frame
 * UVs, and feeds the batcher.
 *
 * Draw order is depth-first child order (Flixel z-model). A drawable is any
 * visible, non-zero-size leaf: `Sprite`s resolve `textureId`/`frame`/flips/tint;
 * plain `Entity`s draw as solid white quads (so boxes/blocks need no image).
 *
 * Scene-agnostic — pass whichever scene is active. All scratch objects are
 * reused, so a frame allocates nothing.
 */
export class RenderView {
    constructor(renderer, loader) {
        // Reused per drawable (batcher.add copies immediately).
        this._t = {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
        this._uv = { u: 0, v: 0, uScale: 0, vScale: 0 };
        this._renderer = renderer;
        this._loader = loader;
        this._inst = {
            texture: loader.white,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            originX: 0,
            originY: 0,
            rotation: 0,
            u: 0,
            v: 0,
            uScale: 1,
            vScale: 1,
            tint: 0xffffff,
            alpha: 1,
        };
    }
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene, alpha) {
        this._renderer.beginFrame(scene.camera.viewProjection());
        this._renderer.batcher.begin();
        this._drawGroup(scene.root, alpha);
        this._renderer.batcher.end();
        this._renderer.endFrame();
    }
    // ---- Internal ----
    _drawGroup(group, alpha) {
        for (const child of group.children) {
            if (!child.visible || !child.alive)
                continue;
            if (child instanceof Group)
                this._drawGroup(child, alpha);
            else
                this._drawEntity(child, alpha);
        }
    }
    _drawEntity(e, alpha) {
        if (e.width === 0 || e.height === 0)
            return; // nothing to rasterize
        const t = e.sampleRender(alpha, this._t);
        const inst = this._inst;
        inst.x = t.x;
        inst.y = t.y;
        inst.width = e.width * t.scaleX;
        inst.height = e.height * t.scaleY;
        inst.rotation = t.rotation;
        if (e instanceof Sprite) {
            const entry = this._loader.resolve(e.textureId);
            entry.meta.frameUV(e.frame, e.flipX, e.flipY, this._uv);
            inst.texture = entry;
            inst.originX = e.originX;
            inst.originY = e.originY;
            inst.tint = e.tint;
            inst.alpha = e.alpha;
        }
        else {
            // Plain entity → solid white quad, top-left anchored.
            this._loader.white.meta.frameUV(0, false, false, this._uv);
            inst.texture = this._loader.white;
            inst.originX = 0;
            inst.originY = 0;
            inst.tint = 0xffffff;
            inst.alpha = 1;
        }
        inst.u = this._uv.u;
        inst.v = this._uv.v;
        inst.uScale = this._uv.uScale;
        inst.vScale = this._uv.vScale;
        this._renderer.batcher.add(inst);
    }
}
