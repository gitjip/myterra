import { FRAME } from '../data/tuning';

/**
 * Converts variable-length real time into a fixed number of simulation steps.
 *
 * Pure and clock-free so it can be unit tested and reused headless. The two
 * guards matter:
 *   - the accumulator is clamped, so a long stall (tab backgrounded, GC pause)
 *     does not queue up seconds of simulation;
 *   - the step count is capped, and any leftover backlog is discarded outright,
 *     which is what actually stops the death spiral.
 */
export class FixedStepRunner {
  private accumulator = 0;

  /** Allows a timestamp rounded to milliseconds to land on a fixed-step edge. */
  private static readonly stepEpsilon = FRAME.fixedDt * 1e-9;

  /** Result of one call to {@link advance}. */
  public advance(realSeconds: number): FixedStepResult {
    const delta = Number.isFinite(realSeconds) && realSeconds > 0 ? realSeconds : 0;
    this.accumulator = Math.min(this.accumulator + delta, FRAME.maxAccumulatedSeconds);

    let steps = 0;
    while (
      this.accumulator + FixedStepRunner.stepEpsilon >= FRAME.fixedDt &&
      steps < FRAME.maxStepsPerFrame
    ) {
      this.accumulator -= FRAME.fixedDt;
      if (this.accumulator < 0) this.accumulator = 0;
      steps++;
    }

    let discarded = 0;
    if (this.accumulator + FixedStepRunner.stepEpsilon >= FRAME.fixedDt) {
      discarded = this.accumulator;
      this.accumulator = 0;
    }

    return { steps, alpha: this.accumulator / FRAME.fixedDt, discarded };
  }

  /** Unprocessed time left over, seconds. */
  public get pending(): number {
    return this.accumulator;
  }

  public reset(): void {
    this.accumulator = 0;
  }
}

export interface FixedStepResult {
  /** Number of fixed updates the caller must now run. */
  steps: number;
  /** 0..1 position between the last two fixed states, for render interpolation. */
  alpha: number;
  /** Backlog thrown away to avoid the death spiral, seconds. Zero normally. */
  discarded: number;
}

export interface RenderInfo {
  readonly alpha: number;
  /** Real seconds since the previous rendered frame. */
  readonly realDelta: number;
  /** Fixed updates executed during this frame. */
  readonly steps: number;
  /** Backlog discarded this frame, seconds. */
  readonly discarded: number;
  readonly frameIndex: number;
}

export interface LoopHandlers {
  fixedUpdate(dt: number): void;
  render(info: RenderInfo): void;
  /** Called when the document becomes hidden or visible. */
  visibilityChanged?(hidden: boolean): void;
}

/** Injection points so the loop can be driven by a fake clock in tests. */
export interface LoopOptions {
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function defaultRequestFrame(callback: (time: number) => void): number {
  return requestAnimationFrame(callback);
}

function defaultCancelFrame(handle: number): void {
  cancelAnimationFrame(handle);
}

/**
 * Drives FixedStepRunner from requestAnimationFrame and pauses itself while the
 * document is hidden, so a backgrounded tab does not burn a core on simulation.
 */
export class GameLoop {
  private readonly runner = new FixedStepRunner();
  private readonly now: () => number;
  private readonly requestFrame: (callback: (time: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private hidden = false;
  private frameIndex = 0;

  public constructor(
    private readonly handlers: LoopHandlers,
    options: LoopOptions = {},
  ) {
    this.now = options.now ?? defaultNow;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public get isHidden(): boolean {
    return this.hidden;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = this.now();
    this.runner.reset();
    this.frameHandle = this.requestFrame(this.tick);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelFrame(this.frameHandle);
  }

  public setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    // Coming back from hidden: drop the stale gap instead of simulating it.
    this.lastTime = this.now();
    this.runner.reset();
    this.handlers.visibilityChanged?.(hidden);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    this.frameHandle = this.requestFrame(this.tick);

    if (this.hidden) {
      this.lastTime = time;
      return;
    }

    const realDelta = Math.max(0, (time - this.lastTime) / 1000);
    this.lastTime = time;

    const { steps, alpha, discarded } = this.runner.advance(realDelta);
    for (let i = 0; i < steps; i++) {
      this.handlers.fixedUpdate(FRAME.fixedDt);
    }

    this.frameIndex++;
    this.handlers.render({ alpha, realDelta, steps, discarded, frameIndex: this.frameIndex });
  };
}
