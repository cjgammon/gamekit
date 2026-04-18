/**
 * Physics - Matter.js wrapper
 * Manages the physics engine and bodies
 */
import Matter from 'matter-js';
export declare class Physics {
    engine: Matter.Engine;
    world: Matter.World;
    private collisionCallbacks;
    constructor(gravity: number);
    /**
     * Set up Matter.js collision event listeners
     */
    private setupCollisionEvents;
    /**
     * Register a collision callback between two bodies
     */
    registerCollision(bodyA: Matter.Body, bodyB: Matter.Body, callback: Function): void;
    /**
     * Unregister a collision callback
     */
    unregisterCollision(bodyA: Matter.Body, bodyB: Matter.Body): void;
    /**
     * Update physics simulation
     * @param deltaMs Time elapsed since last update in milliseconds
     */
    update(deltaMs: number): void;
    /**
     * Add a body to the physics world
     */
    addBody(body: Matter.Body): void;
    /**
     * Remove a body from the physics world
     */
    removeBody(body: Matter.Body): void;
    /**
     * Create a rectangle physics body
     */
    createRectangleBody(x: number, y: number, width: number, height: number, options?: {
        isStatic?: boolean;
        bounce?: number;
        friction?: number;
        density?: number;
        noRotation?: boolean;
    }): Matter.Body;
    /**
     * Create a circle physics body
     */
    createCircleBody(x: number, y: number, radius: number, options?: {
        isStatic?: boolean;
        bounce?: number;
        friction?: number;
        density?: number;
        noRotation?: boolean;
    }): Matter.Body;
}
