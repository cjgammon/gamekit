// server.js
import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";
import { Entity } from "@cjgammon/gamekit";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, PADDLE_INSET, BALL_SIZE,
  TICK_RATE, movePaddle,
} from "./shared.js";

class Paddle extends Entity {
  // The server sets this from the client's input each tick.
  input = { up: false, down: false };

  constructor(side /* "left" | "right" */) {
    super();
    this.width = PADDLE_W;
    this.height = PADDLE_H;
    this.x = side === "left" ? PADDLE_INSET : WIDTH - PADDLE_INSET - PADDLE_W;
    this.y = (HEIGHT - PADDLE_H) / 2;
  }

  // fixedUpdate runs once per server tick — the authoritative simulation.
  fixedUpdate(dt) {
    this.y = movePaddle(this.y, this.input, dt);
  }
}

class Ball extends Entity {
  constructor(game) {
    super();
    this.game = game;
    this.width = BALL_SIZE;
    this.height = BALL_SIZE;
    this.serve(1);
  }

  // Place at center and fire toward `dir` (+1 = right, -1 = left).
  serve(dir) {
    this.x = (WIDTH - BALL_SIZE) / 2;
    this.y = (HEIGHT - BALL_SIZE) / 2;
    const spread = Math.random() * 0.6 - 0.3; // small vertical angle
    this.velocity.set(dir * 200 * Math.cos(spread), 200 * Math.sin(spread));
  }

  fixedUpdate(dt) {
    super.fixedUpdate(dt); // integrate velocity → position

    // Bounce off the top and bottom walls.
    if (this.y < 0) { this.y = 0; this.velocity.y *= -1; }
    if (this.y > HEIGHT - BALL_SIZE) {
      this.y = HEIGHT - BALL_SIZE;
      this.velocity.y *= -1;
    }

    // Bounce off paddles. `bounds` is the entity's world-space box.
    for (const paddle of this.game.paddles()) {
      if (this.bounds.overlaps(paddle.bounds)) {
        // Send the ball away from the paddle's side...
        const left = paddle.x < WIDTH / 2;
        this.velocity.x = Math.abs(this.velocity.x) * (left ? 1 : -1);
        // ...with some "english" based on where it struck the paddle.
        const offset =
          (this.y + BALL_SIZE / 2) - (paddle.y + PADDLE_H / 2);
        this.velocity.y += offset * 4;
        paddle.onHit?.(); // (used later for the flash effect)
      }
    }

    // Past an edge → the other player scores; re-serve toward the loser.
    if (this.x < -BALL_SIZE) { this.game.score(1); this.serve(1); }
    if (this.x > WIDTH) { this.game.score(0); this.serve(-1); }
  }
}

const scores = [0, 0]; // [left, right]

const game = new ServerGame(
  { width: WIDTH, height: HEIGHT, tickRate: TICK_RATE },
  {
    // Called once per connection. index 0 = first player, 1 = second.
    createPlayer: (info) => new Paddle(info.index === 0 ? "left" : "right"),
  },
);

// Helpers the Ball uses. Paddles are the connection entities living in the scene.
game.paddles = () =>
  game.scene.root.children.filter((e) => e instanceof Paddle);
game.score = (who) => {
  scores[who]++;
  game.net.setState({ scores }); // push the new score to all clients
};

// One server-owned ball (not tied to any connection).
game.net.spawn("ball", new Ball(game));
game.net.setState({ scores }); // initial score

// Accept WebSocket connections. (Run with Node — not Bun.)
const ws = new WebSocketServer();
ws.onConnection.add((conn) => game.accept(new ServerTransport(conn)));
ws.listen(39400, () => console.log("pong server on ws://localhost:39400"));
game.start();