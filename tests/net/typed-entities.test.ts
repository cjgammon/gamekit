import { describe, expect, test } from "vitest";
import { ServerGame } from "../../packages/gamekit-server/src/index.js";
import {
  Entity,
  NetClient,
  createMemoryTransportPair,
} from "@cjgammon/gamekit";

function makeServer(playerType?: string) {
  return new ServerGame(
    { width: 200, height: 100, tickRate: 20 },
    { now: () => 0, playerType },
  );
}

/** Connect a throwaway client and capture every type tag its factory sees. */
function connectAndRecordTags(server: ServerGame): string[] {
  const [clientT, serverT] = createMemoryTransportPair();
  const seen: string[] = [];
  const client = new NetClient({
    transport: clientT,
    factory: (type) => {
      seen.push(type);
      return new Entity();
    },
    onSpawn: () => {},
    onDespawn: () => {},
    now: () => 0,
  });
  server.accept(serverT);
  server.tick();
  void client;
  return seen;
}

describe("NetServer playerType option", () => {
  test("defaults the connecting client's entity to the \"player\" tag", () => {
    const server = makeServer();
    const seen = connectAndRecordTags(server);
    expect(seen).toEqual(["player"]);
  });

  test("overrides the connecting client's entity tag when playerType is set", () => {
    const server = makeServer("paddle");
    const seen = connectAndRecordTags(server);
    expect(seen).toEqual(["paddle"]);
  });
});

describe("NetServer<T>", () => {
  test("a custom tag passed to spawn() round-trips to the client via a broadcast snapshot", () => {
    const server = new ServerGame<"player" | "ball">(
      { width: 200, height: 100, tickRate: 20 },
      { now: () => 0 },
    );
    const [clientT, serverT] = createMemoryTransportPair();
    const seen: string[] = [];
    const client = new NetClient({
      transport: clientT,
      factory: (type) => {
        seen.push(type);
        return new Entity();
      },
      onSpawn: () => {},
      onDespawn: () => {},
      now: () => 0,
    });
    server.accept(serverT);
    server.net.spawn("ball", new Entity(5, 5));

    server.tick();

    expect(seen).toContain("ball");
    void client;
  });
});
