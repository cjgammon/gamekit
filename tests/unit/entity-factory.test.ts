import { describe, expect, test } from "vitest";
import { Entity, createEntityFactory } from "../../packages/gamekit/src/index.js";

type NetType = "player" | "ball";

describe("createEntityFactory", () => {
  test("builds entities by type tag", () => {
    const factory = createEntityFactory<NetType>({
      player: () => {
        const e = new Entity();
        e.width = 10;
        return e;
      },
      ball: () => {
        const e = new Entity();
        e.width = 4;
        return e;
      },
    });
    expect(factory("player").width).toBe(10);
    expect(factory("ball").width).toBe(4);
  });

  test("throws a clear error on an unregistered type", () => {
    const factory = createEntityFactory<NetType>({
      player: () => new Entity(),
      ball: () => new Entity(),
    });
    expect(() => factory("enemy")).toThrow(/no builder registered.*"enemy"/);
  });

  test("uses the fallback for unknown types when provided", () => {
    const sentinel = new Entity();
    const factory = createEntityFactory<NetType>(
      { player: () => new Entity(), ball: () => new Entity() },
      () => sentinel,
    );
    expect(factory("anything")).toBe(sentinel);
  });
});
