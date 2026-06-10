import {
  decodeClientMessage,
  encode,
  type Entity,
  type Input,
  type NetId,
  type Scene,
  type SnapshotEntity,
  type Transport,
} from "@cjgammon/gamekit";
import { PlayerEntity } from "../game/PlayerEntity.js";

interface SyncedEntity {
  entity: Entity;
  type: string;
}

/** An entity a connection drives: the server writes its consumed input here. */
export interface Controllable extends Entity {
  input: Input;
}

/** Implement on any synced entity to attach a custom per-entity payload
 *  (health, frame, facing, …) to each snapshot, alongside its transform. */
export interface Syncable {
  netState(): unknown;
}

/** Context handed to a {@link PlayerFactory} when a client connects. */
export interface PlayerInfo {
  /** Stable NetId assigned to this player's entity. */
  id: NetId;
  /** 0-based connection order (0 = first player, 1 = second, ...). */
  index: number;
  worldW: number;
  worldH: number;
}

/** Builds the entity a connecting client controls. Override the default
 *  (a free-moving {@link PlayerEntity}) to make paddles, ships, etc. */
export type PlayerFactory = (info: PlayerInfo) => Controllable;

interface ClientRecord {
  id: NetId;
  transport: Transport;
  entity: Controllable;
  /** Inputs received but not yet consumed (one is consumed per tick). */
  queue: Array<{ seq: number; input: Input }>;
  /** Seq of the last input actually consumed (echoed to the client). */
  lastSeq: number;
}

/**
 * Owns connection and entity lifecycle, transport-agnostic. Each connection
 * gets a player entity spawned into the scene; the server is authoritative —
 * input only sets the player's latest intent, which its `fixedUpdate` consumes.
 */
export class NetServer {
  private readonly _clients = new Map<NetId, ClientRecord>();
  private readonly _synced = new Map<NetId, SyncedEntity>();
  private _nextId: NetId = 1;
  private _state: unknown = undefined;

  constructor(
    private readonly _scene: Scene,
    private readonly _tickRate: number,
    private readonly _worldW: number,
    private readonly _worldH: number,
    /** Builds the entity each connection controls. Defaults to a free-moving
     *  PlayerEntity; supply your own to make paddles, ships, etc. */
    private readonly _createPlayer: PlayerFactory = (i) =>
      new PlayerEntity(
        50 + ((i.id * 60) % i.worldW),
        50,
        i.worldW,
        i.worldH,
      ),
  ) {}

  get clientCount(): number {
    return this._clients.size;
  }

  /** Spawn a synced entity into the scene and assign it a stable NetId. */
  spawn(type: string, entity: Entity): NetId {
    const id = this._nextId++;
    this._scene.add(entity);
    this._synced.set(id, { entity, type });
    return id;
  }

  /** Remove a synced entity (kill() lets the scene's Group sweep it). */
  despawn(id: NetId): void {
    const rec = this._synced.get(id);
    if (!rec) return;
    rec.entity.kill();
    this._synced.delete(id);
  }

  /** Snapshot of authoritative game state (score, round, …) broadcast to every
   *  client. Pass any JSON-serializable value; clients read it as `state`. */
  setState(state: unknown): void {
    this._state = state;
  }

  /** Register a new client connection: spawn its player and greet it. */
  addConnection(transport: Transport, now: number): void {
    const id = this._nextId++;
    const entity = this._createPlayer({
      id,
      index: this._clients.size,
      worldW: this._worldW,
      worldH: this._worldH,
    });
    this._scene.add(entity);
    this._synced.set(id, { entity, type: "player" });
    const rec: ClientRecord = { id, transport, entity, queue: [], lastSeq: 0 };
    this._clients.set(id, rec);

    transport.onMessage.add((data) => this._onMessage(rec, data));
    transport.onClose.add(() => this._onClose(rec));

    transport.send(
      encode({
        k: "welcome",
        tickRate: this._tickRate,
        you: id,
        serverTime: now,
        world: { width: this._worldW, height: this._worldH },
      }),
    );
  }

  /**
   * Consume one queued input per client (held last input if the queue is
   * empty), recording the consumed seq. Call once per tick BEFORE the fixed
   * update so movement is deterministic and lock-stepped with the client.
   */
  consumeInputs(): void {
    for (const rec of this._clients.values()) {
      const next = rec.queue.shift();
      if (next) {
        rec.entity.input = next.input;
        rec.lastSeq = next.seq;
      }
    }
  }

  /** Serialize the world and send a per-client snapshot. */
  broadcast(tick: number, now: number): void {
    const ents = this._collect();
    for (const rec of this._clients.values()) {
      rec.transport.send(
        encode({
          k: "snap",
          tick,
          t: now,
          lastSeq: rec.lastSeq,
          ents,
          state: this._state,
        }),
      );
    }
  }

  private _onMessage(rec: ClientRecord, data: string | ArrayBuffer): void {
    if (typeof data !== "string") return; // JSON only this milestone
    let msg;
    try {
      msg = decodeClientMessage(data);
    } catch {
      return; // ignore malformed input
    }
    if (msg.k === "input") {
      rec.queue.push({ seq: msg.seq, input: msg.input });
    }
  }

  private _onClose(rec: ClientRecord): void {
    this.despawn(rec.id);
    this._clients.delete(rec.id);
  }

  private _collect(): SnapshotEntity[] {
    const out: SnapshotEntity[] = [];
    for (const [id, { entity, type }] of this._synced) {
      if (!entity.alive) continue;
      const e: SnapshotEntity = {
        id,
        t: type,
        x: entity.x,
        y: entity.y,
        r: entity.rotation,
      };
      // Opt-in per-entity payload: include it only if the entity defines one.
      const sync = entity as Partial<Syncable>;
      if (typeof sync.netState === "function") e.s = sync.netState();
      out.push(e);
    }
    return out;
  }
}
