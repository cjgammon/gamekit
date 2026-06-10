import { type Entity, type Input, type NetId, type Scene, type Transport } from "@cjgammon/gamekit";
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
/**
 * Owns connection and entity lifecycle, transport-agnostic. Each connection
 * gets a player entity spawned into the scene; the server is authoritative —
 * input only sets the player's latest intent, which its `fixedUpdate` consumes.
 */
export declare class NetServer {
    private readonly _scene;
    private readonly _tickRate;
    private readonly _worldW;
    private readonly _worldH;
    /** Builds the entity each connection controls. Defaults to a free-moving
     *  PlayerEntity; supply your own to make paddles, ships, etc. */
    private readonly _createPlayer;
    private readonly _clients;
    private readonly _synced;
    private _nextId;
    private _state;
    constructor(_scene: Scene, _tickRate: number, _worldW: number, _worldH: number, 
    /** Builds the entity each connection controls. Defaults to a free-moving
     *  PlayerEntity; supply your own to make paddles, ships, etc. */
    _createPlayer?: PlayerFactory);
    get clientCount(): number;
    /** Spawn a synced entity into the scene and assign it a stable NetId. */
    spawn(type: string, entity: Entity): NetId;
    /** Remove a synced entity (kill() lets the scene's Group sweep it). */
    despawn(id: NetId): void;
    /** Snapshot of authoritative game state (score, round, …) broadcast to every
     *  client. Pass any JSON-serializable value; clients read it as `state`. */
    setState(state: unknown): void;
    /** Register a new client connection: spawn its player and greet it. */
    addConnection(transport: Transport, now: number): void;
    /**
     * Consume one queued input per client (held last input if the queue is
     * empty), recording the consumed seq. Call once per tick BEFORE the fixed
     * update so movement is deterministic and lock-stepped with the client.
     */
    consumeInputs(): void;
    /** Serialize the world and send a per-client snapshot. */
    broadcast(tick: number, now: number): void;
    private _onMessage;
    private _onClose;
    private _collect;
}
