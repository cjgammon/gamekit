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
export declare class AudioManager {
    readonly context: AudioBackend;
    private readonly _master;
    private readonly _sfx;
    private readonly _music;
    private readonly _buffers;
    private _musicSource;
    constructor(context?: AudioBackend);
    get masterVolume(): number;
    set masterVolume(v: number);
    get sfxVolume(): number;
    set sfxVolume(v: number);
    get musicVolume(): number;
    set musicVolume(v: number);
    /** True while the context is suspended (needs a user gesture to start). */
    get suspended(): boolean;
    /** Register a decoded buffer under a name (used by {@link load}). */
    register(name: string, buffer: AudioBuffer): void;
    /** True if a sound is registered under `name`. */
    has(name: string): boolean;
    /** Fetch + decode an audio file and register it under `name`. */
    load(name: string, url: string): Promise<AudioBuffer>;
    /** Load many sounds in parallel. */
    loadAll(specs: Array<{
        name: string;
        url: string;
    }>): Promise<void>;
    /** Resume the context (call from a user gesture to unlock audio). */
    resume(): Promise<void>;
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
    unlockOnGesture(target?: EventTarget | undefined): () => void;
    /**
     * Play a one-shot sound effect. Returns the source (already started), or null
     * if the sound isn't loaded.
     */
    play(name: string, opts?: PlayOptions): AudioBufferSourceNode | null;
    /** Play a track on the music bus (looping by default), replacing any current
     *  music. Returns the source, or null if not loaded. */
    playMusic(name: string, opts?: {
        loop?: boolean;
    }): AudioBufferSourceNode | null;
    /** Stop the current music track, if any. */
    stopMusic(): void;
}
