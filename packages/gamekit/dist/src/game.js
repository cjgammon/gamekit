export class Game {
    constructor(options = {}) {
        console.log(options);
    }
}
export function createGame(options = {}) {
    const game = new Game(options);
    return game;
}
// ------------------------------------------------------------------
//  fitToScreen
//  scales canvas to fill window keeping aspect ratio
// ------------------------------------------------------------------
export function fitToScreen(app, gameWidth, gameHeight) {
    const scale = Math.min(window.innerWidth / gameWidth, window.innerHeight / gameHeight);
    app.renderer.view.style.width = Math.floor(gameWidth * scale) + "px";
    app.renderer.view.style.height = Math.floor(gameHeight * scale) + "px";
}
