import { Ease, type EaseFn } from "./Ease.js";

/** Keys of T whose values are numbers — the only properties a Tween can drive. */
export type NumericKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/** Target values for a tween: a subset of the target's numeric properties. */
export type TweenProps<T> = Partial<Pick<T, NumericKeys<T>>>;

export interface TweenOptions {
  /** Easing function. Default {@link Ease.linear}. */
  ease?: EaseFn;
  /** Seconds to wait before the tween begins. Default 0. */
  delay?: number;
  /** Called once when the tween reaches its target. */
  onComplete?: () => void;
}

interface TweenProp {
  key: string;
  from: number;
  delta: number;
}

/**
 * Interpolates numeric properties of a target object toward goal values over a
 * duration, using an easing function. Advanced on the variable-step `update` by
 * a Scene's {@link TweenManager}.
 *
 * `from` values are sampled when the tween actually starts (after any delay),
 * so chained tweens pick up the latest target state.
 */
export class Tween<T extends object = object> {
  readonly target: T;
  readonly duration: number;
  readonly ease: EaseFn;

  elapsed = 0;
  finished = false;

  private _delay: number;
  private _to: TweenProps<T>;
  private _props: TweenProp[] | null = null; // captured lazily on start
  private _onComplete?: () => void;

  constructor(
    target: T,
    to: TweenProps<T>,
    duration: number,
    options: TweenOptions = {},
  ) {
    this.target = target;
    this._to = to;
    this.duration = duration;
    this.ease = options.ease ?? Ease.linear;
    this._delay = options.delay ?? 0;
    this._onComplete = options.onComplete;
  }

  /** Stop immediately without reaching the target or firing onComplete. */
  stop(): void {
    this.finished = true;
  }

  update(dt: number): void {
    if (this.finished) return;

    // Burn the delay first; any leftover spills into the first step of motion.
    if (this._delay > 0) {
      this._delay -= dt;
      if (this._delay > 0) return;
      dt = -this._delay;
      this._delay = 0;
    }

    if (this._props === null) this._capture();

    this.elapsed += dt;
    let t = this.duration > 0 ? this.elapsed / this.duration : 1;
    if (t >= 1) {
      t = 1;
      this.finished = true;
    }

    const eased = this.ease(t);
    const target = this.target as Record<string, number>;
    for (const p of this._props!) {
      target[p.key] = p.from + p.delta * eased;
    }

    if (this.finished) this._onComplete?.();
  }

  /** Sample current values as the `from` baseline. */
  private _capture(): void {
    const target = this.target as Record<string, number>;
    const props: TweenProp[] = [];
    for (const key in this._to) {
      const to = this._to[key as keyof TweenProps<T>] as unknown as number;
      const from = target[key];
      props.push({ key, from, delta: to - from });
    }
    this._props = props;
  }
}

/**
 * Owns a Scene's active tweens, advancing them each frame and sweeping the
 * finished ones.
 */
export class TweenManager {
  private readonly _tweens: Tween[] = [];

  get count(): number {
    return this._tweens.length;
  }

  /** Create, register, and return a tween. */
  add<T extends object>(
    target: T,
    to: TweenProps<T>,
    duration: number,
    options?: TweenOptions,
  ): Tween<T> {
    const tween = new Tween(target, to, duration, options);
    this._tweens.push(tween as Tween);
    return tween;
  }

  /** Stop and forget every tween. */
  clear(): void {
    this._tweens.length = 0;
  }

  update(dt: number): void {
    const tweens = this._tweens;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tween = tweens[i];
      tween.update(dt);
      if (tween.finished) tweens.splice(i, 1);
    }
  }
}
