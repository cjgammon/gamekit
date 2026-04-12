import * as PIXI from "pixi.js";

export class Game {
  constructor(options: any = {}) {
    console.log(options);
  }
}

export function createGame(options: any = {}) {
  const game: Game = new Game(options);
  return game;
}

// ------------------------------------------------------------------
//  fitToScreen
//  scales canvas to fill window keeping aspect ratio
// ------------------------------------------------------------------
export function fitToScreen(
  app: PIXI.Application,
  gameWidth: number,
  gameHeight: number,
) {
  const scale = Math.min(
    window.innerWidth / gameWidth,
    window.innerHeight / gameHeight,
  );

  app.renderer.view.style!.width = Math.floor(gameWidth * scale) + "px";
  app.renderer.view.style!.height = Math.floor(gameHeight * scale) + "px";
}
