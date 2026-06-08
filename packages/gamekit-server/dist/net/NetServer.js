import { decodeClientMessage, encode, } from "gamekit";
import { PlayerEntity } from "../game/PlayerEntity.js";
/**
 * Owns connection and entity lifecycle, transport-agnostic. Each connection
 * gets a player entity spawned into the scene; the server is authoritative —
 * input only sets the player's latest intent, which its `fixedUpdate` consumes.
 */
export class NetServer {
    constructor(_scene, _tickRate, _worldW, _worldH) {
        this._scene = _scene;
        this._tickRate = _tickRate;
        this._worldW = _worldW;
        this._worldH = _worldH;
        this._clients = new Map();
        this._synced = new Map();
        this._nextId = 1;
    }
    get clientCount() {
        return this._clients.size;
    }
    /** Spawn a synced entity into the scene and assign it a stable NetId. */
    spawn(type, entity) {
        const id = this._nextId++;
        this._scene.add(entity);
        this._synced.set(id, { entity, type });
        return id;
    }
    /** Remove a synced entity (kill() lets the scene's Group sweep it). */
    despawn(id) {
        const rec = this._synced.get(id);
        if (!rec)
            return;
        rec.entity.kill();
        this._synced.delete(id);
    }
    /** Register a new client connection: spawn its player and greet it. */
    addConnection(transport, now) {
        const entity = new PlayerEntity(50 + ((this._nextId * 60) % this._worldW), 50, this._worldW, this._worldH);
        const id = this.spawn("player", entity);
        const rec = { id, transport, entity, queue: [], lastSeq: 0 };
        this._clients.set(id, rec);
        transport.onMessage.add((data) => this._onMessage(rec, data));
        transport.onClose.add(() => this._onClose(rec));
        transport.send(encode({
            k: "welcome",
            tickRate: this._tickRate,
            you: id,
            serverTime: now,
            world: { width: this._worldW, height: this._worldH },
        }));
    }
    /**
     * Consume one queued input per client (held last input if the queue is
     * empty), recording the consumed seq. Call once per tick BEFORE the fixed
     * update so movement is deterministic and lock-stepped with the client.
     */
    consumeInputs() {
        for (const rec of this._clients.values()) {
            const next = rec.queue.shift();
            if (next) {
                rec.entity.input = next.input;
                rec.lastSeq = next.seq;
            }
        }
    }
    /** Serialize the world and send a per-client snapshot. */
    broadcast(tick, now) {
        const ents = this._collect();
        for (const rec of this._clients.values()) {
            rec.transport.send(encode({
                k: "snap",
                tick,
                t: now,
                you: rec.id,
                lastSeq: rec.lastSeq,
                ents,
            }));
        }
    }
    _onMessage(rec, data) {
        if (typeof data !== "string")
            return; // JSON only this milestone
        let msg;
        try {
            msg = decodeClientMessage(data);
        }
        catch {
            return; // ignore malformed input
        }
        if (msg.k === "input") {
            rec.queue.push({ seq: msg.seq, input: msg.input });
        }
    }
    _onClose(rec) {
        this.despawn(rec.id);
        this._clients.delete(rec.id);
    }
    _collect() {
        const out = [];
        for (const [id, { entity, type }] of this._synced) {
            if (!entity.alive)
                continue;
            out.push({ id, t: type, x: entity.x, y: entity.y, r: entity.rotation });
        }
        return out;
    }
}
