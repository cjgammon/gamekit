/**
 * Physics - Matter.js wrapper
 * Manages the physics engine and bodies
 */
import Matter from 'matter-js';
export class Physics {
    constructor(gravity) {
        // Collision callback registry
        this.collisionCallbacks = new Map();
        console.log('[Physics] Creating Matter.js engine');
        console.log(`[Physics] Gravity: ${gravity}`);
        // Create Matter.js engine
        this.engine = Matter.Engine.create({
            gravity: { x: 0, y: gravity }
        });
        this.world = this.engine.world;
        // Set up collision detection
        this.setupCollisionEvents();
        console.log('[Physics] Engine created successfully');
    }
    /**
     * Set up Matter.js collision event listeners
     */
    setupCollisionEvents() {
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                // Create collision pair key (both directions)
                const keyAB = `${bodyA.id}-${bodyB.id}`;
                const keyBA = `${bodyB.id}-${bodyA.id}`;
                // Fire callbacks if registered
                const callbackAB = this.collisionCallbacks.get(keyAB);
                if (callbackAB)
                    callbackAB();
                const callbackBA = this.collisionCallbacks.get(keyBA);
                if (callbackBA)
                    callbackBA();
            }
        });
        console.log('[Physics] Collision detection enabled');
    }
    /**
     * Register a collision callback between two bodies
     */
    registerCollision(bodyA, bodyB, callback) {
        const key = `${bodyA.id}-${bodyB.id}`;
        this.collisionCallbacks.set(key, callback);
        console.log(`[Physics] Collision callback registered: body ${bodyA.id} → body ${bodyB.id}`);
    }
    /**
     * Unregister a collision callback
     */
    unregisterCollision(bodyA, bodyB) {
        const key = `${bodyA.id}-${bodyB.id}`;
        this.collisionCallbacks.delete(key);
    }
    /**
     * Update physics simulation
     * @param deltaMs Time elapsed since last update in milliseconds
     */
    update(deltaMs) {
        Matter.Engine.update(this.engine, deltaMs);
    }
    /**
     * Add a body to the physics world
     */
    addBody(body) {
        Matter.Composite.add(this.world, body);
        console.log('[Physics] Body added to world');
    }
    /**
     * Remove a body from the physics world
     */
    removeBody(body) {
        Matter.Composite.remove(this.world, body);
        console.log('[Physics] Body removed from world');
    }
    /**
     * Create a rectangle physics body
     */
    createRectangleBody(x, y, width, height, options = {}) {
        console.log(`[Physics] Creating rectangle body at (${x}, ${y}), size ${width}x${height}`);
        const bodyOptions = {
            isStatic: options.isStatic ?? false,
            restitution: options.bounce ?? 0.2,
            friction: options.friction ?? 0.8,
            density: options.density ?? 0.001,
            frictionAir: 0.01,
        };
        const body = Matter.Bodies.rectangle(x, y, width, height, bodyOptions);
        // Prevent rotation if specified
        if (options.noRotation ?? true) {
            body.inertia = Infinity;
            body.inverseInertia = 0;
        }
        return body;
    }
    /**
     * Create a circle physics body
     */
    createCircleBody(x, y, radius, options = {}) {
        console.log(`[Physics] Creating circle body at (${x}, ${y}), radius ${radius}`);
        const bodyOptions = {
            isStatic: options.isStatic ?? false,
            restitution: options.bounce ?? 0.2,
            friction: options.friction ?? 0.8,
            density: options.density ?? 0.001,
            frictionAir: 0.01,
        };
        const body = Matter.Bodies.circle(x, y, radius, bodyOptions);
        // Prevent rotation if specified
        if (options.noRotation ?? true) {
            body.inertia = Infinity;
            body.inverseInertia = 0;
        }
        return body;
    }
}
