// ============================================================
//  network.js — multiplayer via Socket.io
//
//  Handles joining rooms, auto-syncing owned sprites,
//  and smoothly interpolating remote (other player) sprites.
// ============================================================

import { io } from "socket.io-client";

// how often to send state updates (milliseconds)
const SYNC_RATE_MS = 50; // 20 times per second

export class Network {
  constructor(serverUrl) {
    this._socket = null;
    this._serverUrl = serverUrl;
    this._roomName = null;
    this._playerName = null;
    this._scene = null;
    this._connected = false;

    // remote sprites: syncId → Sprite
    this._remoteSprites = {};

    // last sent snapshot: syncId → snapshot (for diffing)
    this._lastSent = {};

    // send timer
    this._timeSinceSync = 0;

    // custom event listeners: event → [callbacks]
    this._listeners = {};

    // connect to server
    this._connect();
  }

  // ------------------------------------------------------------------
  //  _connect() — creates the socket and sets up core event handlers
  // ------------------------------------------------------------------
  _connect() {
    this._socket = io(this._serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });

    this._socket.on("connect", () => {
      console.log("[KidEngine] Connected to server:", this._socket.id);
      this._connected = true;

      // rejoin room automatically on reconnect
      if (this._roomName && this._playerName) {
        this._socket.emit("joinRoom", {
          code: this._roomName,
          name: this._playerName,
        });
      }
    });

    this._socket.on("disconnect", () => {
      console.log("[KidEngine] Disconnected from server");
      this._connected = false;
    });

    // another player's sprite state arrived
    this._socket.on("spriteSync", (data) => {
      console.log("wooot", data);
      this._applyRemoteSync(data);
    });

    // another player left — remove their sprites
    this._socket.on("playerLeft", ({ playerId }) => {
      this._removeRemotePlayer(playerId);
    });

    // forward any custom events to registered listeners
    this._socket.onAny((event, data) => {
      if (event.startsWith("_")) return; // internal events
      (this._listeners[event] || []).forEach((cb) => cb(data));
    });
  }

  // ------------------------------------------------------------------
  //  createRoom(playerName, scene) → Promise<{ code, players }>
  //
  //  Creates a new room and returns the 4-letter code to share.
  // ------------------------------------------------------------------
  createRoom(playerName, scene) {
    console.log("createRoom");
    this._playerName = playerName;
    this._scene = scene;
    console.log(">" + scene);

    return new Promise((resolve) => {
      const doCreate = () => {
        this._socket.emit("createRoom", { name: playerName });
        this._socket.once("roomCreated", ({ code, players, sprites }) => {
          this._roomName = code;
          this._applyLateJoinState(sprites);
          resolve({ code, players });
        });
      };

      if (this._connected) doCreate();
      else this._socket.once("connect", doCreate);
    });
  }

  // ------------------------------------------------------------------
  //  joinRoom(code, playerName, scene) → Promise<{ code, players }>
  //
  //  Joins an existing room by 4-letter code.
  // ------------------------------------------------------------------
  joinRoom(code, playerName, scene) {
    console.log("joinRoom");
    this._playerName = playerName;
    this._scene = scene;
    console.log(">" + scene);

    return new Promise((resolve, reject) => {
      const doJoin = () => {
        this._socket.emit("joinRoom", {
          code: code.toUpperCase(),
          name: playerName,
        });

        this._socket.once(
          "roomJoined",
          ({ code: joinedCode, players, sprites }) => {
            this._roomName = joinedCode;
            this._applyLateJoinState(sprites);
            resolve({ code: joinedCode, players });
          },
        );

        this._socket.once("roomError", ({ message }) => {
          reject(new Error(message));
        });
      };

      if (this._connected) doJoin();
      else this._socket.once("connect", doJoin);
    });
  }

  // ------------------------------------------------------------------
  //  _applyLateJoinState(sprites)
  //
  //  When joining a room mid-game, the server sends the last known
  //  positions of all sprites. We create ghosts for them immediately.
  // ------------------------------------------------------------------
  _applyLateJoinState(sprites) {
    if (!this._scene || !Array.isArray(sprites)) return;
    for (const snap of sprites) {
      const key = `${snap._owner}:${snap.id}`;
      if (!this._remoteSprites[key]) {
        const ghost = this._scene._createGhostSprite(snap);
        if (ghost) this._remoteSprites[key] = ghost;
      }
    }
  }

  // ------------------------------------------------------------------
  //  tick(ownedSprites, deltaMs) — called every frame by the game loop
  // ------------------------------------------------------------------
  tick(ownedSprites, deltaMs) {
    if (!this._connected || !this._roomName) return;

    this._timeSinceSync += deltaMs ?? 16;

    if (this._timeSinceSync < SYNC_RATE_MS) return;
    this._timeSinceSync = 0;

    const updates = [];

    for (const sprite of ownedSprites) {
      if (sprite.destroyed) continue;

      const snap = sprite._snapshot();
      const last = this._lastSent[snap.id];

      if (!last || _changed(last, snap)) {
        updates.push(snap);
        this._lastSent[snap.id] = snap;
      }
    }

    if (updates.length > 0) {
      //console.log('[SYNC] Sending', updates.length, 'sprite(s):', updates.map(u => `id=${u.id} (${u.x},${u.y})`));
      this._socket.emit("spriteSync", {
        room: this._roomName,
        sprites: updates,
      });
    }
  }

  // ------------------------------------------------------------------
  //  setScore(score) — report your score to the server
  // ------------------------------------------------------------------
  setScore(score) {
    if (!this._connected || !this._roomName) return;
    this._socket.emit("gameEvent", {
      room: this._roomName,
      event: "scoreUpdate",
      data: { score },
    });
  }

  // ------------------------------------------------------------------
  //  requestLeaderboard() — ask server for current scores
  // ------------------------------------------------------------------
  requestLeaderboard() {
    if (!this._connected) return;
    this._socket.emit("requestLeaderboard");
  }

  // ------------------------------------------------------------------
  //  _applyRemoteSync(data) — receives another player's sprite states
  //
  //  Creates ghost sprites the first time we see a new syncId,
  //  then updates their positions with interpolation.
  // ------------------------------------------------------------------
  _applyRemoteSync(data) {
    console.log("?" + this._scene);
    if (!this._scene) return;

    const { playerId, sprites } = data;
    console.log(
      "[RECV] Received",
      sprites.length,
      "sprite(s) from",
      playerId,
      ":",
      sprites.map((s) => `id=${s.id} (${s.x},${s.y})`),
    );

    for (const snap of sprites) {
      const key = `${playerId}:${snap.id}`;

      if (!this._remoteSprites[key]) {
        // first time seeing this sprite — ask the scene to create a ghost
        const ghost = this._scene._createGhostSprite(snap);
        if (ghost) this._remoteSprites[key] = ghost;
      } else {
        // update existing ghost
        this._remoteSprites[key]._applySnapshot(snap);
      }
    }
  }

  // ------------------------------------------------------------------
  //  _removeRemotePlayer(playerId) — clean up when a player leaves
  // ------------------------------------------------------------------
  _removeRemotePlayer(playerId) {
    const prefix = `${playerId}:`;
    for (const key of Object.keys(this._remoteSprites)) {
      if (key.startsWith(prefix)) {
        this._remoteSprites[key].destroy();
        delete this._remoteSprites[key];
      }
    }
  }

  // ------------------------------------------------------------------
  //  on(event, callback) — listen for custom game messages
  //  send(event, data)   — send a custom game message to the room
  // ------------------------------------------------------------------
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  send(event, data) {
    if (!this._connected) return;
    this._socket.emit("gameEvent", {
      room: this._roomName,
      event,
      data,
    });
  }
}

// ------------------------------------------------------------------
//  _changed(last, snap) — returns true if the snapshot is different
//  enough from the last one to be worth sending
// ------------------------------------------------------------------
function _changed(last, snap) {
  const POS_THRESHOLD = 0.5; // pixels
  const VEL_THRESHOLD = 0.1; // pixels/frame
  const ANG_THRESHOLD = 0.01; // radians

  return (
    Math.abs(last.x - snap.x) > POS_THRESHOLD ||
    Math.abs(last.y - snap.y) > POS_THRESHOLD ||
    Math.abs(last.vx - snap.vx) > VEL_THRESHOLD ||
    Math.abs(last.vy - snap.vy) > VEL_THRESHOLD ||
    Math.abs(last.a - snap.a) > ANG_THRESHOLD
  );
}
