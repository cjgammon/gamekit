import { Signal } from "../core/Signal.js";
import type { Entity } from "../core/Entity.js";
import { Interpolator } from "./Interpolator.js";
import type { Transport } from "./Transport.js";
import {
  EMPTY_INPUT,
  type Input,
  type NetId,
  type ServerMessage,
} from "./protocol.js";
import { defaultCodec, type Codec } from "./codec.js";

/** Creates a client-side entity for a given server type tag. */
export type EntityFactory = (type: string) => Entity;

/** Implement on a factory-created entity to receive its server-sent custom
 *  payload (the value the server entity's `netState()` returned). */
export interface NetStateReceiver {
  applyNetState(state: unknown): void;
}

/** World context handed to a prediction simulate step. */
export interface PredictContext {
  worldW: number;
  worldH: number;
}

/** Advances one entity by one input step. MUST match the server's simulation.
 *  `input` is the value you sent via `setLocalInput` — cast it to your shape. */
export type SimulateFn = (
  entity: Entity,
  input: Input,
  dt: number,
  ctx: PredictContext,
) => void;

export interface NetClientOptions {
  transport: Transport;
  factory: EntityFactory;
  onSpawn: (id: NetId, entity: Entity) => void;
  onDespawn: (id: NetId, entity: Entity) => void;
  /** Clock (ms). Defaults to Date.now; tests pass a fake clock. */
  now?: () => number;
  /**
   * Provide to enable client-side prediction of the local player (2b). Omit for
   * pure interpolation of all entities (2a).
   */
  simulate?: SimulateFn;
  /** Wire codec. Defaults to the compact binary codec; must match the server. */
  codec?: Codec;
}

/** How far behind server time to render remote entities, in ms (≈2 ticks @ 20Hz). */
const INTERPOLATION_DELAY = 100;

/** Cap on buffered predicted inputs. Only reached if the server stops acking
 *  (a stalled or dead connection); bounds memory at the cost of dropping the
 *  oldest unacked inputs, which a healthy connection never hits. */
const MAX_INPUT_HISTORY = 256;

interface PendingInput {
  seq: number;
  input: Input;
}

/** Shallow-copy a flat input object so stored history isn't mutated later. */
function cloneInput(input: Input): Input {
  return input && typeof input === "object"
    ? { ...(input as Record<string, unknown>) }
    : input;
}

/**
 * Client end of the protocol. Receives snapshots, reconciles the set of live
 * entities (spawn unknown ids via a factory, despawn ids absent from a
 * snapshot), and authors transforms each frame: remote entities are
 * interpolated ~100ms behind server time; the local player is predicted from
 * input and reconciled against authoritative snapshots when `simulate` is set.
 */
export class NetClient {
  readonly interpolator = new Interpolator();
  readonly entities = new Map<NetId, Entity>();
  /** Fires once the welcome message has been processed. */
  readonly onWelcome = new Signal<void>();

  /** NetId of this client's own player (0 until welcomed). */
  you: NetId = 0;
  /** Server fixed tick rate (Hz), learned from the welcome message. */
  tickRate = 20;
  /** Last input seq the server acked. */
  lastSeq = 0;
  /** Latest authoritative game state from the server (score, etc.), or
   *  undefined until the server sends one. Cast it to your own shape. */
  state: unknown = undefined;
  /** Fires whenever a new `state` arrives in a snapshot. */
  readonly onState = new Signal<unknown>();

  private readonly _transport: Transport;
  private readonly _factory: EntityFactory;
  private readonly _onSpawn: (id: NetId, entity: Entity) => void;
  private readonly _onDespawn: (id: NetId, entity: Entity) => void;
  private readonly _now: () => number;
  private readonly _simulate: SimulateFn | null;
  private readonly _codec: Codec;

  private _connected = false;
  private _seq = 0;
  private _clockOffset = 0; // localNow - serverTime
  private _world = { width: 0, height: 0 };
  /** Integration step for prediction, in seconds — derived from the server's
   *  tick rate so each predicted/replayed input advances exactly as it did on
   *  the server. Seeded from the default tickRate, finalized at welcome. */
  private _fixedStep = 1 / this.tickRate;

  // Prediction state (only used when _simulate is set).
  private _localEntity: Entity | null = null;
  private _localInput: Input = { ...EMPTY_INPUT };
  private _history: PendingInput[] = [];

  constructor(options: NetClientOptions) {
    this._transport = options.transport;
    this._factory = options.factory;
    this._onSpawn = options.onSpawn;
    this._onDespawn = options.onDespawn;
    this._now = options.now ?? (() => Date.now());
    this._simulate = options.simulate ?? null;
    this._codec = options.codec ?? defaultCodec;
    this._transport.onMessage.add((data) => this._onMessage(data));
  }

  get connected(): boolean {
    return this._connected;
  }

  /** True if `id` is this client's own player. */
  isLocal(id: NetId): boolean {
    return id === this.you;
  }

  /** Set the latest local input (polled by the app, e.g. on key change). Input
   *  is any JSON value; a flat object is shallow-copied so later mutation of
   *  your own object doesn't corrupt the prediction history. */
  setLocalInput(input: Input): void {
    this._localInput = cloneInput(input);
  }

  /** Send a one-off input (2a path / no prediction). */
  sendInput(input: Input): void {
    this._sendInput(input);
  }

  /**
   * Prediction tick — call once per client fixed step (e.g. from a Scene's
   * fixedUpdate). Sends the current input, records it for replay, and advances
   * the predicted local entity by exactly one server step. No-op without
   * `simulate`.
   *
   * The integration step is derived from the welcomed tick rate, not from the
   * host loop's dt, so replay during reconciliation reproduces the server's
   * motion exactly. For the prediction cadence to match the server, drive this
   * from a loop running at {@link tickRate} (i.e. construct the host `Game`
   * with the server's tick rate).
   */
  predict(): void {
    if (!this._connected || !this._simulate) return;
    const input = this._localInput;
    const seq = this._sendInput(input);
    this._history.push({ seq, input: cloneInput(input) });
    if (this._history.length > MAX_INPUT_HISTORY) this._history.shift();
    if (this._localEntity) {
      this._simulate(this._localEntity, input, this._fixedStep, this._ctx());
    }
  }

  /** Encode and send one input, advancing the sequence. Returns its seq. */
  private _sendInput(input: Input): number {
    this._seq++;
    this._transport.send(this._codec.encode({ k: "input", seq: this._seq, input }));
    return this._seq;
  }

  /**
   * Write rendered transforms for this frame. Remote entities interpolate;
   * the local predicted entity is left as prediction authored it.
   */
  apply(): void {
    if (!this._connected) return;
    const renderTime = this._now() - this._clockOffset - INTERPOLATION_DELAY;
    for (const [id, entity] of this.entities) {
      if (this._simulate && id === this.you) continue; // predicted, not interpolated
      const s = this.interpolator.sample(id, renderTime);
      if (s) {
        entity.x = s.x;
        entity.y = s.y;
        entity.rotation = s.r;
      }
    }
  }

  private _ctx(): PredictContext {
    return { worldW: this._world.width, worldH: this._world.height };
  }

  private _onMessage(data: string | ArrayBuffer): void {
    let msg: ServerMessage;
    try {
      msg = this._codec.decodeServer(data);
    } catch {
      return;
    }

    if (msg.k === "welcome") {
      this.you = msg.you;
      this.tickRate = msg.tickRate;
      this._fixedStep = 1 / msg.tickRate;
      this._world = msg.world;
      this._clockOffset = this._now() - msg.serverTime;
      this._connected = true;
      this.onWelcome.emit();
    } else if (msg.k === "snap") {
      this.lastSeq = msg.lastSeq;
      this.interpolator.push(msg);
      this._reconcileMembership(msg);
      if (this._simulate) this._reconcileLocal(msg);
      if (msg.state !== undefined) {
        this.state = msg.state;
        this.onState.emit(msg.state);
      }
    }
  }

  private _reconcileMembership(msg: Extract<ServerMessage, { k: "snap" }>): void {
    const present = new Set<NetId>();
    for (const e of msg.ents) {
      present.add(e.id);
      let entity = this.entities.get(e.id);
      if (!entity) {
        entity = this._factory(e.t);
        // Transforms are authored by interpolation/prediction, not by the
        // entity's own motion integration — keep it passive in the scene, and
        // skip render interpolation (the net layer already smooths it).
        entity.active = false;
        entity.interpolate = false;
        this.entities.set(e.id, entity);
        if (e.id === this.you) this._localEntity = entity;
        this._onSpawn(e.id, entity);
      }
      // Deliver the per-entity payload (latest value, not interpolated).
      if (e.s !== undefined) {
        const recv = entity as Partial<NetStateReceiver>;
        recv.applyNetState?.(e.s);
      }
    }
    for (const [id, entity] of this.entities) {
      if (!present.has(id)) {
        this.entities.delete(id);
        if (entity === this._localEntity) this._localEntity = null;
        this._onDespawn(id, entity);
      }
    }
  }

  /**
   * Reset the local entity to the authoritative state, drop acked inputs, and
   * replay the still-unacknowledged ones — so the predicted position reflects
   * server truth plus inputs the server hasn't processed yet.
   */
  private _reconcileLocal(msg: Extract<ServerMessage, { k: "snap" }>): void {
    if (!this._localEntity || !this._simulate) return;
    const auth = msg.ents.find((e) => e.id === this.you);
    if (!auth) return;

    this._localEntity.x = auth.x;
    this._localEntity.y = auth.y;
    this._localEntity.rotation = auth.r;

    this._history = this._history.filter((h) => h.seq > msg.lastSeq);
    const ctx = this._ctx();
    for (const h of this._history) {
      this._simulate(this._localEntity, h.input, this._fixedStep, ctx);
    }
  }
}
