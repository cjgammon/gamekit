import { describe, expect, test } from "bun:test";
import {
  AudioManager,
  type AudioBackend,
} from "../../packages/gamekit/src/audio/index.js";

// ---- Fake WebAudio backend (records the graph + playback) ----

interface FakeGain {
  kind: "gain";
  gain: { value: number };
  dest: FakeNode | null;
  connect(n: FakeNode): void;
}
interface FakeSource {
  kind: "source";
  buffer: unknown;
  loop: boolean;
  playbackRate: { value: number };
  dest: FakeNode | null;
  started: boolean;
  stopped: boolean;
  connect(n: FakeNode): void;
  start(): void;
  stop(): void;
}
type FakeNode = FakeGain | FakeSource | { kind: "destination" };

function fakeBackend() {
  const destination = { kind: "destination" as const };
  const gains: FakeGain[] = [];
  const sources: FakeSource[] = [];
  let resumed = false;
  let state: AudioContextState = "suspended";

  const backend = {
    destination,
    currentTime: 0,
    get state() {
      return state;
    },
    createGain(): GainNode {
      const g: FakeGain = {
        kind: "gain",
        gain: { value: 1 },
        dest: null,
        connect(n) {
          this.dest = n;
        },
      };
      gains.push(g);
      return g as unknown as GainNode;
    },
    createBufferSource(): AudioBufferSourceNode {
      const s: FakeSource = {
        kind: "source",
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        dest: null,
        started: false,
        stopped: false,
        connect(n) {
          this.dest = n;
        },
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(s);
      return s as unknown as AudioBufferSourceNode;
    },
    async decodeAudioData() {
      return {} as AudioBuffer;
    },
    async resume() {
      resumed = true;
      state = "running";
    },
  };

  return {
    backend: backend as unknown as AudioBackend,
    gains,
    sources,
    destination,
    get resumed() {
      return resumed;
    },
    setState(s: AudioContextState) {
      state = s;
    },
  };
}

const buf = {} as AudioBuffer;

describe("AudioManager graph", () => {
  test("wires sfx + music groups through master to destination", () => {
    const f = fakeBackend();
    new AudioManager(f.backend);
    // 3 gains: master, sfx, music. sfx/music → master → destination.
    expect(f.gains.length).toBe(3);
    const [master, sfx, music] = f.gains;
    expect(master.dest).toBe(f.destination);
    expect(sfx.dest).toBe(master);
    expect(music.dest).toBe(master);
  });

  test("volume getters/setters drive the group gains", () => {
    const audio = new AudioManager(fakeBackend().backend);
    audio.masterVolume = 0.5;
    audio.sfxVolume = 0.25;
    audio.musicVolume = 0.75;
    expect(audio.masterVolume).toBe(0.5);
    expect(audio.sfxVolume).toBe(0.25);
    expect(audio.musicVolume).toBe(0.75);
  });
});

describe("AudioManager SFX", () => {
  test("play returns null for an unregistered sound", () => {
    const audio = new AudioManager(fakeBackend().backend);
    expect(audio.play("missing")).toBeNull();
  });

  test("play starts a source routed to the sfx group", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    const sfxGain = f.gains[1];
    audio.register("shoot", buf);
    const src = audio.play("shoot") as unknown as { started: boolean; dest: unknown; loop: boolean };
    expect(src.started).toBe(true);
    expect(src.loop).toBe(false);
    expect(src.dest).toBe(sfxGain);
  });

  test("per-play volume inserts a gain between source and sfx group", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    audio.register("hit", buf);
    audio.play("hit", { volume: 0.3 });
    // A 4th gain was created with value 0.3, feeding the sfx group.
    const playGain = f.gains[3];
    expect(playGain.gain.value).toBe(0.3);
    expect(playGain.dest).toBe(f.gains[1]); // → sfx group
  });

  test("rate sets the source playbackRate", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    audio.register("blip", buf);
    audio.play("blip", { rate: 1.5 });
    expect(f.sources.at(-1)!.playbackRate.value).toBe(1.5);
  });
});

describe("AudioManager music", () => {
  test("playMusic loops and routes to the music group", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    const musicGain = f.gains[2];
    audio.register("theme", buf);
    const src = audio.playMusic("theme") as unknown as { loop: boolean; dest: unknown };
    expect(src.loop).toBe(true);
    expect(src.dest).toBe(musicGain);
  });

  test("starting new music stops the previous track", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    audio.register("a", buf);
    audio.register("b", buf);
    const first = audio.playMusic("a") as unknown as { stopped: boolean };
    audio.playMusic("b");
    expect(first.stopped).toBe(true);
  });

  test("stopMusic stops the current track", () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    audio.register("song", buf);
    const src = audio.playMusic("song") as unknown as { stopped: boolean };
    audio.stopMusic();
    expect(src.stopped).toBe(true);
    audio.stopMusic(); // idempotent, no throw
  });
});

describe("AudioManager context", () => {
  test("resume unlocks the context", async () => {
    const f = fakeBackend();
    const audio = new AudioManager(f.backend);
    expect(audio.suspended).toBe(true);
    await audio.resume();
    expect(f.resumed).toBe(true);
    expect(audio.suspended).toBe(false);
  });
});
