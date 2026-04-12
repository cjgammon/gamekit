// ============================================================
//  scoring.js — built-in score tracking and win condition
//
//  Tracks scores for 'left' and 'right' sides (or any two
//  named sides), updates the HUD, handles the reset pause,
//  and fires the win screen when a player reaches winScore.
// ============================================================

export class Scoring {

  constructor(network, options = {}) {
    this._network    = network;
    this._winScore   = options.winScore   ?? 7;
    this._resetDelay = options.resetDelay ?? 1200; // ms between point and relaunch

    // scores keyed by side name ('left', 'right', or custom)
    this._scores  = {};
    this._onScore = null; // callback fired after each point + reset delay
    this._onWin   = null; // callback fired when someone wins
    this._paused  = false;

    // sync scores to guests when we update them
    this._network?.on('scoreSync', ({ scores }) => {
      this._scores = scores;
      this._updateHUD();
    });
  }

  // ------------------------------------------------------------------
  //  score(side) — called by game code when a point is scored
  //
  //  side: 'left' | 'right' | any string you define
  //
  //  Only the host should call this — scores are synced to guests.
  // ------------------------------------------------------------------
  score(side) {
    if (this._paused) return;

    this._scores[side] = (this._scores[side] ?? 0) + 1;
    this._updateHUD();

    // sync to guests
    this._network?.send('scoreSync', { scores: this._scores });

    // check win condition
    if (this._scores[side] >= this._winScore) {
      this._triggerWin(side);
      return;
    }

    // pause, then fire onScore so game can reset/relaunch
    this._paused = true;
    setTimeout(() => {
      this._paused = false;
      this._onScore?.(side, this._scores);
    }, this._resetDelay);
  }

  // ------------------------------------------------------------------
  //  getScore(side) — read a score
  // ------------------------------------------------------------------
  getScore(side) {
    return this._scores[side] ?? 0;
  }

  // ------------------------------------------------------------------
  //  onScore(callback) — fires after each point (after reset delay)
  //  callback receives (winningSide, allScores)
  //  Use this to relaunch the ball / reset positions
  // ------------------------------------------------------------------
  onScore(callback) {
    this._onScore = callback;
  }

  // ------------------------------------------------------------------
  //  onWin(callback) — fires when a player reaches winScore
  //  callback receives (winningSide, allScores)
  // ------------------------------------------------------------------
  onWin(callback) {
    this._onWin = callback;
  }

  // ------------------------------------------------------------------
  //  isPaused() — true during the reset delay between points
  // ------------------------------------------------------------------
  isPaused() {
    return this._paused;
  }

  // ------------------------------------------------------------------
  //  _updateHUD — sync scores to the DOM elements
  // ------------------------------------------------------------------
  _updateHUD() {
    const left  = document.getElementById('gk-score-left');
    const right = document.getElementById('gk-score-right');
    if (left)  left.textContent  = this._scores['left']  ?? 0;
    if (right) right.textContent = this._scores['right'] ?? 0;
  }

  // ------------------------------------------------------------------
  //  _triggerWin — show the win screen
  // ------------------------------------------------------------------
  _triggerWin(winningSide) {
    this._paused = true;

    const winner  = document.getElementById('gk-winner');
    const winText = document.getElementById('gk-winner-text');

    this._onWin?.(winningSide, this._scores);

    if (winner && winText) {
      // The game can set winner text via onWin callback,
      // but we show the overlay either way
      winner.classList.add('visible');
    }
  }

  // ------------------------------------------------------------------
  //  setWinnerText(text) — set what shows on the win screen
  // ------------------------------------------------------------------
  setWinnerText(text) {
    const el = document.getElementById('gk-winner-text');
    if (el) el.textContent = text;
  }
}
