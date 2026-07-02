/** The landing page's live demo — a tiny playable scene run in the sandbox
 *  iframe (same one the tutorial uses). Click the canvas, then WASD/arrows to
 *  move and grab the gold coins. */
export const liveDemoSrc = `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 220;

class PlayScene extends Scene {
  player!: Sprite;
  coin!: Sprite;
  sparks!: Emitter;
  score = 0;

  create() {
    this.camera.centerOn(240, 180);

    this.sparks = new Emitter(0, 0);
    this.sparks.speed = { min: 60, max: 180 };
    this.sparks.life = { min: 0.3, max: 0.6 };
    this.sparks.particleWidth = 5;
    this.sparks.particleHeight = 5;
    this.sparks.tints = [0xffcc44, 0xffe28a, 0xffffff];
    this.add(this.sparks);

    this.player = new Sprite();
    this.player.textureId = "";
    this.player.width = 36;
    this.player.height = 36;
    this.player.tint = 0x6ca8ff;
    this.add(this.player);
    this.player.setPosition(220, 200);

    this.coin = new Sprite();
    this.coin.textureId = "";
    this.coin.width = 26;
    this.coin.height = 26;
    this.coin.tint = 0xffcc44;
    this.placeCoin();
    this.add(this.coin);

    hud("Score: 0  —  WASD / arrows to move");
  }

  placeCoin() {
    this.coin.setPosition(40 + Math.random() * 400, 40 + Math.random() * 280);
  }

  fixedUpdate(dt) {
    super.fixedUpdate(dt);
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);

    this.overlap(this.player, this.coin, () => {
      this.score++;
      this.sparks.setPosition(this.coin.x, this.coin.y);
      this.sparks.explode(16);
      this.camera.shake(4, 0.15);
      this.placeCoin();
      hud("Score: " + this.score + "  —  WASD / arrows to move");
    });
  }
}

game.switchScene(new PlayScene());
game.start();
`;
