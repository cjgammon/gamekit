import { describe, expect, test } from "bun:test";
import {
  ServerGame,
  type Controllable,
  type PlayerInfo,
} from "../../packages/gamekit-server/src/index.js";
import {
  EMPTY_INPUT,
  Entity,
  NetClient,
  createMemoryTransportPair,
  type InputState,
} from "@cjgammon/gamekit";

/** A custom connection entity (a Pong-style vertical paddle). */
class Paddle extends Entity implements Controllable {
  input: InputState = { ...EMPTY_INPUT };

  override fixedUpdate(dt: number): void {
    const dir = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    this.y += dir * 100 * dt;
  }
}

function paddleFactory(info: PlayerInfo): Controllable {
  const p = new Paddle();
  p.x = info.index === 0 ? 10 : 180; // first player left, second right
  p.y = 50;
  p.width = 8;
  p.height = 24;
  return p;
}

function makeServer(createPlayer?: (i: PlayerInfo) => Controllable) {
  return new ServerGame(
    { width: 200, height: 100, tickRate: 20 },
    { now: () => 0, createPlayer },
  );
}

/** Connect a throwaway client; returns its NetClient. */
function connect(server: ServerGame): NetClient {
  const [clientT, serverT] = createMemoryTransportPair();
  const client = new NetClient({
    transport: clientT,
    factory: () => new Entity(),
    onSpawn: () => {},
    onDespawn: () => {},
    now: () => 0,
  });
  server.accept(serverT);
  return client;
}

describe("custom player factory", () => {
  test("each connection is driven by the factory's entity, placed by index", () => {
    const server = makeServer(paddleFactory);
    connect(server); // index 0 → x 10
    connect(server); // index 1 → x 180

    const paddles = server.scene.root.children.filter(
      (e): e is Paddle => e instanceof Paddle,
    );
    expect(paddles.length).toBe(2);
    expect(paddles.map((p) => p.x).sort((a, b) => a - b)).toEqual([10, 180]);
  });

  test("client input routes to the custom entity", () => {
    const server = makeServer(paddleFactory);
    const client = connect(server);
    const paddle = server.scene.root.children.find(
      (e): e is Paddle => e instanceof Paddle,
    )!;
    const y0 = paddle.y;

    client.sendInput({ up: false, down: true, left: false, right: false });
    server.tick(); // consumeInputs → paddle.input, then fixedUpdate moves it down

    expect(paddle.y).toBeGreaterThan(y0);
  });

  test("defaults to a free-moving player when no factory is given", () => {
    const server = makeServer(); // default
    connect(server);
    // The default PlayerEntity is a plain Entity (not our Paddle).
    expect(server.scene.root.children.some((e) => e instanceof Paddle)).toBe(false);
    expect(server.scene.root.children.length).toBe(1);
  });
});

describe("synced game state", () => {
  test("setState broadcasts authoritative state to clients", () => {
    const server = makeServer(paddleFactory);
    const client = connect(server);

    server.net.setState({ scores: [3, 1] });
    server.tick(); // snapshot carries the state (delivered synchronously)

    expect(client.state).toEqual({ scores: [3, 1] });
  });

  test("clients without any server state see undefined", () => {
    const server = makeServer(paddleFactory);
    const client = connect(server);
    server.tick();
    expect(client.state).toBeUndefined();
  });

  test("onState fires when state arrives", () => {
    const server = makeServer(paddleFactory);
    const client = connect(server);
    let got: unknown = null;
    client.onState.add((s) => (got = s));

    server.net.setState({ round: 2 });
    server.tick();

    expect(got).toEqual({ round: 2 });
  });
});

describe("generic (custom-shape) input", () => {
  // An entity that uses its own input shape, not the default 4 buttons.
  interface ShipInput {
    thrust: number;
    firing: boolean;
  }
  class Ship extends Entity implements Controllable {
    input: unknown = { thrust: 0, firing: false };
    fired = false;
    speed = 0;
    override fixedUpdate(): void {
      const i = this.input as ShipInput;
      this.speed = i.thrust;
      if (i.firing) this.fired = true;
    }
  }

  test("an arbitrary input object reaches the entity intact", () => {
    const server = makeServer(() => new Ship());
    const client = connect(server);
    const ship = server.scene.root.children.find(
      (e): e is Ship => e instanceof Ship,
    )!;

    client.sendInput({ thrust: 0.75, firing: true });
    server.tick();

    expect(ship.speed).toBe(0.75);
    expect(ship.fired).toBe(true);
  });
});

describe("per-entity custom payloads", () => {
  // Server entity exposes netState(); the client entity receives it.
  class Bot extends Entity {
    hp = 3;
    netState() {
      return { hp: this.hp };
    }
  }
  class BotView extends Entity {
    hp = 0;
    applyNetState(s: unknown) {
      this.hp = (s as { hp: number }).hp;
    }
  }

  test("netState() on the server reaches applyNetState() on the client", () => {
    const server = makeServer(paddleFactory);
    const bot = new Bot();
    server.net.spawn("bot", bot);

    const [clientT, serverT] = createMemoryTransportPair();
    const views = new Map<number, BotView>();
    const client = new NetClient({
      transport: clientT,
      factory: (type) => (type === "bot" ? new BotView() : new Entity()),
      onSpawn: (id, e) => {
        if (e instanceof BotView) views.set(id, e);
      },
      onDespawn: () => {},
      now: () => 0,
    });
    server.accept(serverT);

    bot.hp = 2;
    server.tick();
    const view = [...views.values()][0];
    expect(view.hp).toBe(2);

    bot.hp = 1; // updates flow on every snapshot, not just spawn
    server.tick();
    expect(view.hp).toBe(1);

    void client; // (silence unused)
  });

  test("entities without netState() omit the payload (no client error)", () => {
    const server = makeServer(paddleFactory);
    const client = connect(server);
    // A plain synced entity — no netState. Should just sync transforms.
    server.net.spawn("rock", new Entity(5, 5));
    expect(() => server.tick()).not.toThrow();
    void client;
  });
});
