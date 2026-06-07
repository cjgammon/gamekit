/**
 * Physics - Matter.js wrapper
 * Manages the physics engine and bodies
 */

import Matter from "matter-js";

export class Physics {
  public engine: Matter.Engine;
  public world: Matter.World;
  public render: Matter.Render;

  // Collision callback registry
  private collisionCallbacks: Map<string, Function> = new Map();

  constructor(gravity: number) {
    console.log("[Physics] Creating Matter.js engine");
    console.log(`[Physics] Gravity: ${gravity}`);

    // Create Matter.js engine
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: gravity },
    });

    this.render = Matter.Render.create({
      element: document.body,
      engine: this.engine,
      options: {
        width: 800,
        height: 600,
        wireframes: true, // Essential for seeing true physical body shapes
        showDebug: true, // Enables general debug info
        showPositions: true, // Draws center of mass and positions
        showBounds: true, // Displays bounding boxes of bodies
        showVelocity: true, // Draws vectors showing movement speed/direction
        showCollisions: true, // Highlights active collision points
        showAxes: true, // Shows internal body orientation axes
        showAngleIndicator: true, // Draws a line showing the body's rotation
        showSleeping: true, // Changes color of bodies that are resting/sleeping
      },
    });

    this.render.canvas.style.position = "absolute";
    this.render.canvas.style.top = "0";
    this.render.canvas.style.left = "0";
    this.render.canvas.style.background = "blue";
    this.render.canvas.style.opacity = "0.5";
    this.render.canvas.style.zIndex = "100000";

    console.log("...", this.render);

    this.world = this.engine.world;

    // Set up collision detection
    this.setupCollisionEvents();

    console.log("[Physics] Engine created successfully");
  }

  /**
   * Set up Matter.js collision event listeners
   */
  private setupCollisionEvents(): void {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Create collision pair key (both directions)
        const keyAB = `${bodyA.id}-${bodyB.id}`;
        const keyBA = `${bodyB.id}-${bodyA.id}`;

        // Fire callbacks if registered
        const callbackAB = this.collisionCallbacks.get(keyAB);
        if (callbackAB) callbackAB();

        const callbackBA = this.collisionCallbacks.get(keyBA);
        if (callbackBA) callbackBA();
      }
    });

    console.log("[Physics] Collision detection enabled");
  }

  /**
   * Register a collision callback between two bodies
   */
  registerCollision(
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    callback: Function,
  ): void {
    const key = `${bodyA.id}-${bodyB.id}`;
    this.collisionCallbacks.set(key, callback);
    console.log(
      `[Physics] Collision callback registered: body ${bodyA.id} → body ${bodyB.id}`,
    );
  }

  /**
   * Unregister a collision callback
   */
  unregisterCollision(bodyA: Matter.Body, bodyB: Matter.Body): void {
    const key = `${bodyA.id}-${bodyB.id}`;
    this.collisionCallbacks.delete(key);
  }

  /**
   * Update physics simulation
   * @param deltaMs Time elapsed since last update in milliseconds
   */
  update(deltaMs: number): void {
    Matter.Engine.update(this.engine, deltaMs);
    Matter.Render.world(this.render);
  }

  /**
   * Add a body to the physics world
   */
  addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
    console.log("[Physics] Body added to world");
  }

  /**
   * Remove a body from the physics world
   */
  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
    console.log("[Physics] Body removed from world");
  }

  /**
   * Create a rectangle physics body
   */
  createRectangleBody(
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      isStatic?: boolean;
      bounce?: number;
      friction?: number;
      density?: number;
      noRotation?: boolean;
      frictionAir?: number;
    } = {},
  ): Matter.Body {
    console.log(
      `[Physics] Creating rectangle body at (${x}, ${y}), size ${width}x${height}`,
    );

    const bodyOptions = {
      isStatic: options.isStatic ?? false,
      restitution: options.bounce ?? 0.2,
      friction: options.friction ?? 0.8,
      density: options.density ?? 0.001,
      frictionAir: options.frictionAir ?? 0.01,
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
  createCircleBody(
    x: number,
    y: number,
    radius: number,
    options: {
      isStatic?: boolean;
      bounce?: number;
      friction?: number;
      density?: number;
      noRotation?: boolean;
      frictionAir?: number;
    } = {},
  ): Matter.Body {
    console.log(
      `[Physics] Creating circle body at (${x}, ${y}), radius ${radius}`,
    );

    const bodyOptions = {
      isStatic: options.isStatic ?? false,
      restitution: options.bounce ?? 0.2,
      friction: options.friction ?? 0.8,
      density: options.density ?? 0.001,
      frictionAir: options.frictionAir ?? 0.01,
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
