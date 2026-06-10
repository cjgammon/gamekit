import { Signal } from "../core/Signal.js";
import { Interpolator } from "./Interpolator.js";
import { EMPTY_INPUT, decodeServerMessage, encode, } from "./protocol.js";
/** How far behind server time to render remote entities, in ms (≈2 ticks @ 20Hz). */
const INTERPOLATION_DELAY = 100;
/** Cap on buffered predicted inputs. Only reached if the server stops acking
 *  (a stalled or dead connection); bounds memory at the cost of dropping the
 *  oldest unacked inputs, which a healthy connection never hits. */
const MAX_INPUT_HISTORY = 256;
/**
 * Client end of the protocol. Receives snapshots, reconciles the set of live
 * entities (spawn unknown ids via a factory, despawn ids absent from a
 * snapshot), and authors transforms each frame: remote entities are
 * interpolated ~100ms behind server time; the local player is predicted from
 * input and reconciled against authoritative snapshots when `simulate` is set.
 */
export class NetClient {
    constructor(options) {
        this.interpolator = new Interpolator();
        this.entities = new Map();
        /** Fires once the welcome message has been processed. */
        this.onWelcome = new Signal();
        /** NetId of this client's own player (0 until welcomed). */
        this.you = 0;
        /** Server fixed tick rate (Hz), learned from the welcome message. */
        this.tickRate = 20;
        /** Last input seq the server acked. */
        this.lastSeq = 0;
        /** Latest authoritative game state from the server (score, etc.), or
         *  undefined until the server sends one. Cast it to your own shape. */
        this.state = undefined;
        /** Fires whenever a new `state` arrives in a snapshot. */
        this.onState = new Signal();
        this._connected = false;
        this._seq = 0;
        this._clockOffset = 0; // localNow - serverTime
        this._world = { width: 0, height: 0 };
        /** Integration step for prediction, in seconds — derived from the server's
         *  tick rate so each predicted/replayed input advances exactly as it did on
         *  the server. Seeded from the default tickRate, finalized at welcome. */
        this._fixedStep = 1 / this.tickRate;
        // Prediction state (only used when _simulate is set).
        this._localEntity = null;
        this._localInput = { ...EMPTY_INPUT };
        this._history = [];
        this._transport = options.transport;
        this._factory = options.factory;
        this._onSpawn = options.onSpawn;
        this._onDespawn = options.onDespawn;
        this._now = options.now ?? (() => Date.now());
        this._simulate = options.simulate ?? null;
        this._transport.onMessage.add((data) => this._onMessage(data));
    }
    get connected() {
        return this._connected;
    }
    /** True if `id` is this client's own player. */
    isLocal(id) {
        return id === this.you;
    }
    /** Set the latest local input (polled by the app, e.g. on key change). */
    setLocalInput(input) {
        this._localInput = { ...input };
    }
    /** Send a one-off input (2a path / no prediction). */
    sendInput(input) {
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
    predict() {
        if (!this._connected || !this._simulate)
            return;
        const input = this._localInput;
        const seq = this._sendInput(input);
        this._history.push({ seq, input: { ...input } });
        if (this._history.length > MAX_INPUT_HISTORY)
            this._history.shift();
        if (this._localEntity) {
            this._simulate(this._localEntity, input, this._fixedStep, this._ctx());
        }
    }
    /** Encode and send one input, advancing the sequence. Returns its seq. */
    _sendInput(input) {
        this._seq++;
        this._transport.send(encode({ k: "input", seq: this._seq, input }));
        return this._seq;
    }
    /**
     * Write rendered transforms for this frame. Remote entities interpolate;
     * the local predicted entity is left as prediction authored it.
     */
    apply() {
        if (!this._connected)
            return;
        const renderTime = this._now() - this._clockOffset - INTERPOLATION_DELAY;
        for (const [id, entity] of this.entities) {
            if (this._simulate && id === this.you)
                continue; // predicted, not interpolated
            const s = this.interpolator.sample(id, renderTime);
            if (s) {
                entity.x = s.x;
                entity.y = s.y;
                entity.rotation = s.r;
            }
        }
    }
    _ctx() {
        return { worldW: this._world.width, worldH: this._world.height };
    }
    _onMessage(data) {
        if (typeof data !== "string")
            return;
        let msg;
        try {
            msg = decodeServerMessage(data);
        }
        catch {
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
        }
        else if (msg.k === "snap") {
            this.lastSeq = msg.lastSeq;
            this.interpolator.push(msg);
            this._reconcileMembership(msg);
            if (this._simulate)
                this._reconcileLocal(msg);
            if (msg.state !== undefined) {
                this.state = msg.state;
                this.onState.emit(msg.state);
            }
        }
    }
    _reconcileMembership(msg) {
        const present = new Set();
        for (const e of msg.ents) {
            present.add(e.id);
            if (!this.entities.has(e.id)) {
                const entity = this._factory(e.t);
                // Transforms are authored by interpolation/prediction, not by the
                // entity's own motion integration — keep it passive in the scene, and
                // skip render interpolation (the net layer already smooths it).
                entity.active = false;
                entity.interpolate = false;
                this.entities.set(e.id, entity);
                if (e.id === this.you)
                    this._localEntity = entity;
                this._onSpawn(e.id, entity);
            }
        }
        for (const [id, entity] of this.entities) {
            if (!present.has(id)) {
                this.entities.delete(id);
                if (entity === this._localEntity)
                    this._localEntity = null;
                this._onDespawn(id, entity);
            }
        }
    }
    /**
     * Reset the local entity to the authoritative state, drop acked inputs, and
     * replay the still-unacknowledged ones — so the predicted position reflects
     * server truth plus inputs the server hasn't processed yet.
     */
    _reconcileLocal(msg) {
        if (!this._localEntity || !this._simulate)
            return;
        const auth = msg.ents.find((e) => e.id === this.you);
        if (!auth)
            return;
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
