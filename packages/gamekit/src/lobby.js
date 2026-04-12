// ============================================================
//  lobby.js — built-in multiplayer lobby
//
//  Handles the create/join UI, waits for all players to join,
//  then fires onReady() so the game can start.
//
//  Works in two modes:
//    1. Built-in UI — engine injects its own HTML
//    2. Custom UI   — game provides element selectors via lobbyElements
// ============================================================

const BUILT_IN_STYLES = `
  #gk-lobby-overlay {
    position: fixed;
    inset: 0;
    background: #111;
    color: #fff;
    font-family: 'Courier New', monospace;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  #gk-lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 40px;
    max-width: 360px;
    width: 100%;
  }
  #gk-lobby h2 {
    font-size: 42px;
    letter-spacing: 8px;
    margin: 0;
  }
  #gk-lobby p {
    color: #666;
    font-size: 13px;
    text-align: center;
    margin: 0;
  }
  .gk-input-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }
  .gk-input-row label {
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .gk-input {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    font-family: 'Courier New', monospace;
    font-size: 18px;
    letter-spacing: 3px;
    padding: 10px 14px;
    text-align: center;
    text-transform: uppercase;
    width: 100%;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .gk-input:focus { border-color: #666; }
  .gk-btn-row {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .gk-btn {
    background: #fff;
    border: none;
    border-radius: 6px;
    color: #111;
    cursor: pointer;
    flex: 1;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 2px;
    padding: 12px;
    text-transform: uppercase;
    transition: background 0.15s;
  }
  .gk-btn:hover    { background: #ddd; }
  .gk-btn:disabled { background: #444; color: #888; cursor: default; }
  .gk-btn-ghost {
    background: transparent;
    border: 1px solid #333;
    color: #888;
  }
  .gk-btn-ghost:hover { border-color: #888; color: #fff; background: transparent; }
  .gk-divider {
    width: 100%;
    border: none;
    border-top: 1px solid #222;
    margin: 4px 0;
  }
  #gk-code-display {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  #gk-code-display span   { font-size: 10px; color: #555; letter-spacing: 2px; text-transform: uppercase; }
  #gk-code-display strong { font-size: 48px; letter-spacing: 10px; }
  #gk-status { font-size: 12px; color: #666; text-align: center; min-height: 18px; }
  #gk-status.error { color: #ff6b6b; }

  #gk-hud {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0;
    padding: 14px 28px;
    justify-content: space-between;
    align-items: center;
    font-family: 'Courier New', monospace;
    font-size: 28px;
    letter-spacing: 4px;
    pointer-events: none;
    z-index: 10;
    color: #fff;
  }
  #gk-hud.visible { display: flex; }
  #gk-hud-center  { font-size: 11px; color: #444; letter-spacing: 2px; }

  #gk-winner {
    display: none;
    position: fixed;
    inset: 0;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    background: rgba(0,0,0,0.8);
    z-index: 20;
    font-family: 'Courier New', monospace;
    color: #fff;
  }
  #gk-winner.visible { display: flex; }
  #gk-winner h2      { font-size: 36px; letter-spacing: 6px; margin: 0; }
  #gk-winner button  {
    background: #fff;
    border: none;
    border-radius: 6px;
    color: #111;
    cursor: pointer;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 2px;
    padding: 12px 28px;
    text-transform: uppercase;
  }
`;

const BUILT_IN_HTML = (title) => `
  <div id="gk-lobby-overlay">
    <div id="gk-lobby">
      <h2>${title}</h2>
      <p>Create a game and share the code,<br>or join a friend's room.</p>

      <div class="gk-input-row">
        <label>Your name</label>
        <input id="gk-name" class="gk-input" type="text" maxlength="12" placeholder="PLAYER" value="PLAYER" />
      </div>

      <div class="gk-btn-row">
        <button id="gk-btn-create" class="gk-btn">Create game</button>
      </div>

      <div id="gk-code-display">
        <span>Share this code</span>
        <strong id="gk-code"></strong>
        <p style="font-size:11px;color:#444">Waiting for players…</p>
      </div>

      <hr class="gk-divider" />

      <div class="gk-input-row">
        <label>Join with code</label>
        <input id="gk-code-input" class="gk-input" type="text" maxlength="4" placeholder="ABCD" />
      </div>
      <div class="gk-btn-row">
        <button id="gk-btn-join" class="gk-btn gk-btn-ghost">Join game</button>
      </div>

      <div id="gk-status"></div>
    </div>
  </div>

  <div id="gk-hud">
    <div id="gk-score-left">0</div>
    <div id="gk-hud-center">●</div>
    <div id="gk-score-right">0</div>
  </div>

  <div id="gk-winner">
    <h2 id="gk-winner-text"></h2>
    <button id="gk-btn-restart">Play again</button>
  </div>
`;

export class Lobby {
  constructor(network, canvas, options = {}) {
    this._network = network;
    this._canvas = canvas;
    this._maxPlayers = options.maxPlayers ?? 2;
    this._title = options.title ?? "GAME";
    this._custom = options.lobbyElements ?? null;
    this._onReady = null;

    this._playerCount = 1; // host counts as 1
    this._isHost = false;
    this._players = [];

    this._injectUI();
    this._wire();
  }

  // ------------------------------------------------------------------
  //  onReady(callback) — called when all players have joined
  //  callback receives { isHost, players, myIndex }
  // ------------------------------------------------------------------
  onReady(callback) {
    this._onReady = callback;
  }

  // ------------------------------------------------------------------
  //  _injectUI — adds HTML + styles to the page
  // ------------------------------------------------------------------
  _injectUI() {
    if (this._custom) return; // game provides its own HTML

    // inject styles
    const style = document.createElement("style");
    style.textContent = BUILT_IN_STYLES;
    document.head.appendChild(style);

    // inject HTML before the canvas
    const wrapper = document.createElement("div");
    wrapper.innerHTML = BUILT_IN_HTML(this._title);
    document.body.insertBefore(wrapper, this._canvas);

    // hide canvas until game starts
    this._canvas.style.display = "none";
  }

  // ------------------------------------------------------------------
  //  _el(builtIn, custom) — get element by built-in id or custom selector
  // ------------------------------------------------------------------
  _el(builtInId, customKey) {
    if (this._custom && this._custom[customKey]) {
      return document.querySelector(this._custom[customKey]);
    }
    return document.getElementById(builtInId);
  }

  // ------------------------------------------------------------------
  //  _wire — attach event listeners to lobby buttons
  // ------------------------------------------------------------------
  _wire() {
    const btnCreate = this._el("gk-btn-create", "btnCreate");
    const btnJoin = this._el("gk-btn-join", "btnJoin");
    const codeInput = this._el("gk-code-input", "codeInput");

    btnCreate?.addEventListener("click", () => this._handleCreate());
    btnJoin?.addEventListener("click", () => this._handleJoin());

    codeInput?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });

    // restart button — just reload
    document.getElementById("gk-btn-restart")?.addEventListener("click", () => {
      window.location.reload();
    });

    // listen for players joining
    this._network.on("playerJoined", ({ player }) => {
      this._playerCount++;
      this._players.push(player);
      this._setStatus(
        `${this._playerCount}/${this._maxPlayers} players joined…`,
      );

      if (this._playerCount >= this._maxPlayers) {
        this._roomFull();
      }
    });

    // guest receives gameStart from host
    this._network.on("gameStart", ({ players }) => {
      this._players = players;
      this._isHost = false;
      this._startGame();
    });
  }

  // ------------------------------------------------------------------
  //  _handleCreate — create a room
  // ------------------------------------------------------------------
  async _handleCreate() {
    const name = this._el("gk-name", "nameInput")?.value.trim() || "PLAYER";
    const btnCreate = this._el("gk-btn-create", "btnCreate");

    btnCreate.disabled = true;
    this._setStatus("Creating room…");

    try {
      const { code, players } = await this._network.createRoom(name);
      this._isHost = true;
      this._players = players;

      // show the code
      const codeDisplay = document.getElementById("gk-code-display");
      const codeEl = document.getElementById("gk-code");
      if (codeDisplay) codeDisplay.style.display = "flex";
      if (codeEl) codeEl.textContent = code;

      const customCodeDisplay = this._custom?.codeDisplay
        ? document.querySelector(this._custom.codeDisplay)
        : null;
      if (customCodeDisplay) customCodeDisplay.textContent = code;

      this._setStatus("");
      btnCreate.style.display = "none";
    } catch (err) {
      this._setStatus("Could not connect. Is the server running?", true);
      btnCreate.disabled = false;
    }
  }

  // ------------------------------------------------------------------
  //  _handleJoin — join a room by code
  // ------------------------------------------------------------------
  async _handleJoin() {
    const code = this._el("gk-code-input", "codeInput")
      ?.value.trim()
      .toUpperCase();
    const name = this._el("gk-name", "nameInput")?.value.trim() || "PLAYER";
    const btnJoin = this._el("gk-btn-join", "btnJoin");

    if (!code || code.length !== 4) {
      this._setStatus("Enter a 4-letter code!", true);
      return;
    }

    btnJoin.disabled = true;
    this._setStatus(`Joining room ${code}…`);

    try {
      const { players } = await this._network.joinRoom(code, name);
      this._players = players;
      this._setStatus("Joined! Waiting for host to start…");
    } catch (err) {
      this._setStatus(err.message, true);
      btnJoin.disabled = false;
    }
  }

  // ------------------------------------------------------------------
  //  _roomFull — host sees all players joined, starts the game
  // ------------------------------------------------------------------
  _roomFull() {
    this._setStatus("All players joined! Starting…");

    setTimeout(() => {
      // tell all guests to start
      this._network.send("gameStart", {
        players: this._players,
      });
      this._startGame();
    }, 800);
  }

  // ------------------------------------------------------------------
  //  _startGame — hide lobby, show canvas, fire onReady
  // ------------------------------------------------------------------
  _startGame() {
    // hide built-in lobby overlay
    const overlay = document.getElementById("gk-lobby-overlay");
    if (overlay) overlay.style.display = "none";

    // hide custom lobby elements if provided
    if (this._custom?.lobbyContainer) {
      const el = document.querySelector(this._custom.lobbyContainer);
      if (el) el.style.display = "none";
    }

    // show canvas and HUD
    this._canvas.style.display = "block";
    const hud = document.getElementById("gk-hud");
    if (hud) hud.classList.add("visible");

    // fire onReady with player info
    const myId = this._network._socket?.id;
    const myIndex = this._players.findIndex((p) => p.id === myId);

    this._onReady?.({
      isHost: this._isHost,
      players: this._players,
      myIndex: myIndex >= 0 ? myIndex : 0,
    });
  }

  // ------------------------------------------------------------------
  //  _setStatus — update the status message
  // ------------------------------------------------------------------
  _setStatus(msg, isError = false) {
    const el = this._el("gk-status", "status");
    if (!el) return;
    el.textContent = msg;
    el.className = isError ? "error" : "";
  }
}
