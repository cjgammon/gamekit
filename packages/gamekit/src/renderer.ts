/**
 * Renderer - PixiJS wrapper
 * Manages the canvas and rendering pipeline
 */

import * as PIXI from 'pixi.js';

export class Renderer {
  public app: PIXI.Application;
  public stage: PIXI.Container;

  constructor(width: number, height: number, background: number) {
    console.log('[Renderer] Creating PixiJS Application');
    console.log(`[Renderer] Size: ${width}x${height}, Background: 0x${background.toString(16)}`);

    // Create PixiJS Application
    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: background,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    this.stage = this.app.stage;

    // Add canvas to page
    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.display = 'block';
    document.body.appendChild(canvas);

    // Style the page
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000';

    // Auto-scale canvas to fit window
    this.fitToScreen(width, height);
    window.addEventListener('resize', () => this.fitToScreen(width, height));

    console.log('[Renderer] Canvas created and added to page');
  }

  /**
   * Scale canvas to fit window while maintaining aspect ratio
   */
  private fitToScreen(gameWidth: number, gameHeight: number): void {
    const scale = Math.min(
      window.innerWidth / gameWidth,
      window.innerHeight / gameHeight
    );

    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.width = Math.floor(gameWidth * scale) + 'px';
    canvas.style.height = Math.floor(gameHeight * scale) + 'px';
    canvas.style.marginLeft = 'auto';
    canvas.style.marginRight = 'auto';
  }

  /**
   * Start the render loop
   */
  start(callback: () => void): void {
    this.app.ticker.add(callback);
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this.app.ticker.stop();
  }

  /**
   * Add a display object to the stage
   */
  addToStage(displayObject: PIXI.DisplayObject): void {
    this.stage.addChild(displayObject);
  }

  /**
   * Remove a display object from the stage
   */
  removeFromStage(displayObject: PIXI.DisplayObject): void {
    this.stage.removeChild(displayObject);
  }
}
