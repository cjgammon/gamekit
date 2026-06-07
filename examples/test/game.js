import { Game, GKBox, GKCircle } from "gamekit";

const serverUrl =
  new URLSearchParams(window.location.search).get("server") ||
  "http://localhost:3000";
console.log(`Server URL: ${serverUrl}`);

const game = new Game({
  width: 800,
  height: 600,
  gravity: 0,
  background: 0xff0000,
  server: serverUrl,
});

const character = new GKBox({
  x: 50, // Will be repositioned
  y: 300,
  width: 15,
  height: 100,
  color: 0xffffff,
  mass: 1,
  isStatic: true,
  bounce: 0,
  friction: 0.01,
});
game.add(character);

game.onUpdate(() => {});

