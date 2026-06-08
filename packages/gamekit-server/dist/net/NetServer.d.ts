import { type Entity, type NetId, type Scene, type Transport } from "gamekit";
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
    private readonly _clients;
    private readonly _synced;
    private _nextId;
    constructor(_scene: Scene, _tickRate: number, _worldW: number, _worldH: number);
    get clientCount(): number;
    /** Spawn a synced entity into the scene and assign it a stable NetId. */
    spawn(type: string, entity: Entity): NetId;
    /** Remove a synced entity (kill() lets the scene's Group sweep it). */
    despawn(id: NetId): void;
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
