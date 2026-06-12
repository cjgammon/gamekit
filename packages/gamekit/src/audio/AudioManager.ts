/**
 * The subset of `AudioContext` the manager uses, injected so the routing and
 * registry logic can be unit-tested with a fake (no real WebAudio).
 */
export interface AudioBackend {
  readonly destination: AudioNode;
  readonly currentTime: number;
  readonly state: AudioContextState;
  createGain(): GainNode;
  createBufferSource(): AudioBufferSourceNode;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  resume(): Promise<void>;
}

/** Options for a one-shot sound effect. */
export interface PlayOptions {
  /** Per-play volume multiplier (0..1). Default 1. */
  volume?: number;
  /** Playback rate / pitch. Default 1. */
  rate?: number;
  /** Loop the sound. Default false. */
  loop?: boolean;
}

/**
 * WebAudio sound: loads named buffers, plays one-shot SFX and looping music,
 * with master/SFX/music volume groups. Browser-only (`AudioContext`, `fetch`),
 * so it lives behind the `gamekit/audio` subpath — never the package root —
 * keeping the headless server DOM-free.
 *
 * Routing: each source → its group gain (`sfx`/`music`) → master → destination.
 * Browsers start the context suspended until a user gesture; call {@link resume}
 * from a click/keypress to unlock playback.
 */
export class AudioManager {
  readonly context: AudioBackend;

  private readonly _master: GainNode;
  private readonly _sfx: GainNode;
  private readonly _music: GainNode;
  private readonly _buffers = new Map<string, AudioBuffer>();
  private _musicSource: AudioBufferSourceNode | null = null;

  constructor(context: AudioBackend = new AudioContext()) {
    this.context = context;
    this._master = context.createGain();
    this._sfx = context.createGain();
    this._music = context.createGain();
    this._sfx.connect(this._master);
    this._music.connect(this._master);
    this._master.connect(context.destination);
  }

  // ---- Volume groups (0..1) ----

  get masterVolume(): number {
    return this._master.gain.value;
  }
  set masterVolume(v: number) {
    this._master.gain.value = v;
  }

  get sfxVolume(): number {
    return this._sfx.gain.value;
  }
  set sfxVolume(v: number) {
    this._sfx.gain.value = v;
  }

  get musicVolume(): number {
    return this._music.gain.value;
  }
  set musicVolume(v: number) {
    this._music.gain.value = v;
  }

  /** True while the context is suspended (needs a user gesture to start). */
  get suspended(): boolean {
    return this.context.state === "suspended";
  }

  // ---- Loading / registry ----

  /** Register a decoded buffer under a name (used by {@link load}). */
  register(name: string, buffer: AudioBuffer): void {
    this._buffers.set(name, buffer);
  }

  /** True if a sound is registered under `name`. */
  has(name: string): boolean {
    return this._buffers.has(name);
  }

  /** Fetch + decode an audio file and register it under `name`. */
  async load(name: string, url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load sound "${name}": ${res.status}`);
    const buffer = await this.context.decodeAudioData(await res.arrayBuffer());
    this.register(name, buffer);
    return buffer;
  }

  /** Load many sounds in parallel. */
  async loadAll(specs: Array<{ name: string; url: string }>): Promise<void> {
    await Promise.all(specs.map((s) => this.load(s.name, s.url)));
  }

  // ---- Playback ----

  /** Resume the context (call from a user gesture to unlock audio). */
  resume(): Promise<void> {
    return this.context.resume();
  }

  /**
   * Unlock audio on the first user gesture. Browsers start the context
   * suspended until the user interacts; this registers one-shot `keydown` /
   * `pointerdown` listeners that {@link resume} the context, then remove
   * themselves. Returns a function that cancels the pending listeners (rarely
   * needed). Browser-only — no-op without a DOM event target.
   *
   * ```ts
   * const audio = new AudioManager();
   * audio.unlockOnGesture(); // that's it — first key/click starts audio
   * ```
   */
  unlockOnGesture(
    target: EventTarget | undefined = typeof window !== "undefined"
      ? window
      : undefined,
  ): () => void {
    if (!target) return () => {};
    const unlock = () => {
      void this.resume();
      cancel();
    };
    const cancel = () => {
      target.removeEventListener("keydown", unlock);
      target.removeEventListener("pointerdown", unlock);
    };
    target.addEventListener("keydown", unlock);
    target.addEventListener("pointerdown", unlock);
    return cancel;
  }

  /**
   * Play a one-shot sound effect. Returns the source (already started), or null
   * if the sound isn't loaded.
   */
  play(name: string, opts: PlayOptions = {}): AudioBufferSourceNode | null {
    const buffer = this._buffers.get(name);
    if (!buffer) return null;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = opts.loop ?? false;
    source.playbackRate.value = opts.rate ?? 1;

    if (opts.volume !== undefined && opts.volume !== 1) {
      const gain = this.context.createGain();
      gain.gain.value = opts.volume;
      source.connect(gain);
      gain.connect(this._sfx);
    } else {
      source.connect(this._sfx);
    }
    source.start();
    return source;
  }

  /** Play a track on the music bus (looping by default), replacing any current
   *  music. Returns the source, or null if not loaded. */
  playMusic(
    name: string,
    opts: { loop?: boolean } = {},
  ): AudioBufferSourceNode | null {
    const buffer = this._buffers.get(name);
    if (!buffer) return null;

    this.stopMusic();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = opts.loop ?? true;
    source.connect(this._music);
    source.start();
    this._musicSource = source;
    return source;
  }

  /** Stop the current music track, if any. */
  stopMusic(): void {
    if (this._musicSource) {
      this._musicSource.stop();
      this._musicSource = null;
    }
  }
}
