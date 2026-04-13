/**
 * Renderer - PixiJS wrapper
 * Manages the canvas and rendering pipeline
 */
import * as PIXI from 'pixi.js';
export declare class Renderer {
    app: PIXI.Application;
    stage: PIXI.Container;
    constructor(width: number, height: number, background: number);
    /**
     * Scale canvas to fit window while maintaining aspect ratio
     */
    private fitToScreen;
    /**
     * Start the render loop
     */
    start(callback: () => void): void;
    /**
     * Stop the render loop
     */
    stop(): void;
    /**
     * Add a display object to the stage
     */
    addToStage(displayObject: PIXI.DisplayObject): void;
    /**
     * Remove a display object from the stage
     */
    removeFromStage(displayObject: PIXI.DisplayObject): void;
}
