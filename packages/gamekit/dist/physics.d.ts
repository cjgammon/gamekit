export declare class Physics {
    constructor(engine: any, world: any);
    add(sprite: any, options?: {}): any;
    applyForce(sprite: any, force: any): void;
    onCollide(spriteA: any, spriteB: any, callback: any): void;
    onOverlap(spriteA: any, spriteB: any, callback: any): void;
    buildTilemapBodies(solidRects: any, tileSize: any): void;
    removeBody(sprite: any): void;
    _handleCollision(event: any, type: any): void;
}
