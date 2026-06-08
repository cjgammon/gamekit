import { Signal } from "../core/Signal.js";
import type { Entity } from "../core/Entity.js";
import { Interpolator } from "./Interpolator.js";
import type { Transport } from "./Transport.js";
import { type InputState, type NetId } from "./protocol.js";
/** Creates a client-side entity for a given server type tag. */
export type EntityFactory = (type: string) => Entity;
/** World context handed to a prediction simulate step. */
export interface PredictContext {
    worldW: number;
    worldH: number;
}
/** Advances one entity by one input step. MUST match the server's simulation. */
export type SimulateFn = (entity: Entity, input: InputState, dt: number, ctx: PredictContext) => void;
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
}
/**
 * Client end of the protocol. Receives snapshots, reconciles the set of live
 * entities (spawn unknown ids via a factory, despawn ids absent from a
 * snapshot), and authors transforms each frame: remote entities are
 * interpolated ~100ms behind server time; the local player is predicted from
 * input and reconciled against authoritative snapshots when `simulate` is set.
 */
export declare class NetClient {
    readonly interpolator: Interpolator;
    readonly entities: Map<number, Entity>;
    /** Fires once the welcome message has been processed. */
    readonly onWelcome: Signal<void>;
    /** NetId of this client's own player (0 until welcomed). */
    you: NetId;
    /** Server fixed tick rate (Hz), learned from the welcome message. */
    tickRate: number;
    /** Last input seq the server acked. */
    lastSeq: number;
    private readonly _transport;
    private readonly _factory;
    private readonly _onSpawn;
    private readonly _onDespawn;
    private readonly _now;
    private readonly _simulate;
    private _connected;
    private _seq;
    private _clockOffset;
    private _world;
    /** Integration step for prediction, in seconds — derived from the server's
     *  tick rate so each predicted/replayed input advances exactly as it did on
     *  the server. Seeded from the default tickRate, finalized at welcome. */
    private _fixedStep;
    private _localEntity;
    private _localInput;
    private _history;
    constructor(options: NetClientOptions);
    get connected(): boolean;
    /** True if `id` is this client's own player. */
    isLocal(id: NetId): boolean;
    /** Set the latest local input (polled by the app, e.g. on key change). */
    setLocalInput(input: InputState): void;
    /** Send a one-off input (2a path / no prediction). */
    sendInput(input: InputState): void;
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
    predict(): void;
    /** Encode and send one input, advancing the sequence. Returns its seq. */
    private _sendInput;
    /**
     * Write rendered transforms for this frame. Remote entities interpolate;
     * the local predicted entity is left as prediction authored it.
     */
    apply(): void;
    private _ctx;
    private _onMessage;
    private _reconcileMembership;
    /**
     * Reset the local entity to the authoritative state, drop acked inputs, and
     * replay the still-unacknowledged ones — so the predicted position reflects
     * server truth plus inputs the server hasn't processed yet.
     */
    private _reconcileLocal;
}
