import { DEBUG, FRAME, FRAME_BUDGET_MS } from '../data/tuning';
import type { BudgetKey } from '../data/tuning';

/**
 * Named-span frame timing with a rolling window, plus the budget bookkeeping
 * the F3 overlay renders. Every subsystem that has a per-frame budget must
 * report through here, otherwise "no red" is a lie.
 */

export interface SpanStats {
  readonly name: string;
  /** Most recent measurement, ms. */
  readonly last: number;
  readonly avg: number;
  readonly p95: number;
  readonly max: number;
  readonly samples: number;
  /** Budget in ms, or null for spans that have none. */
  readonly budget: number | null;
  /** True when the last measurement exceeded the budget. */
  readonly overBudget: boolean;
  /** True when the rolling average exceeds the budget. */
  readonly avgOverBudget: boolean;
}

interface SpanInternal {
  readonly name: string;
  readonly samples: Float64Array;
  budget: number | null;
  head: number;
  count: number;
  last: number;
}

export function defaultClock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export class Profiler {
  private readonly spans = new Map<string, SpanInternal>();
  private readonly stack: Array<{ span: SpanInternal; startedAt: number }> = [];
  private readonly window: number;
  private readonly clock: () => number;

  public constructor(
    clock: () => number = defaultClock,
    windowSize: number = DEBUG.profilerWindow,
  ) {
    this.clock = clock;
    this.window = Math.max(1, windowSize);
  }

  /** Open a span. Spans must be closed in LIFO order. */
  public begin(name: string, budget: number | null = null): void {
    const existing = this.spans.get(name);
    const span =
      existing ??
      ({
        name,
        samples: new Float64Array(this.window),
        budget,
        head: 0,
        count: 0,
        last: 0,
      } satisfies SpanInternal);
    if (existing && budget !== null && span.budget !== budget) span.budget = budget;
    this.spans.set(name, span);
    this.stack.push({ span, startedAt: this.clock() });
  }

  /** Close the innermost span. Returns its duration in ms. */
  public end(): number {
    const frame = this.stack.pop();
    if (!frame) return 0;
    return this.record(frame.span, this.clock() - frame.startedAt);
  }

  /** Run `fn` inside a span and return its result. */
  public measure<T>(name: string, budget: number | null, fn: () => T): T {
    this.begin(name, budget);
    try {
      return fn();
    } finally {
      this.end();
    }
  }

  public stats(): SpanStats[] {
    const out: SpanStats[] = [];
    for (const span of this.spans.values()) {
      const avg = this.average(span);
      out.push({
        name: span.name,
        last: span.last,
        avg,
        p95: this.percentile(span, 0.95),
        max: this.max(span),
        samples: span.count,
        budget: span.budget,
        overBudget: span.budget !== null && span.last > span.budget,
        avgOverBudget: span.budget !== null && avg > span.budget,
      });
    }
    return out.sort((a, b) => b.avg - a.avg);
  }

  public get(name: string): SpanStats | undefined {
    return this.stats().find((s) => s.name === name);
  }

  public reset(): void {
    this.spans.clear();
    this.stack.length = 0;
  }

  /** Discards the accumulated samples but keeps the span registered. */
  public clearWindow(): void {
    for (const span of this.spans.values()) {
      span.head = 0;
      span.count = 0;
      span.last = 0;
    }
  }

  private record(span: SpanInternal, ms: number): number {
    const value = ms > 0 ? ms : 0;
    span.samples[span.head] = value;
    span.head = (span.head + 1) % this.window;
    if (span.count < this.window) span.count++;
    span.last = value;
    return value;
  }

  private snapshot(span: SpanInternal): number[] {
    const out: number[] = new Array<number>(span.count);
    for (let i = 0; i < span.count; i++) {
      const index = (span.head - span.count + i + this.window * 2) % this.window;
      out[i] = span.samples[index] as number;
    }
    return out;
  }

  private average(span: SpanInternal): number {
    if (span.count === 0) return 0;
    const values = this.snapshot(span);
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
  }

  private percentile(span: SpanInternal, q: number): number {
    if (span.count === 0) return 0;
    const values = this.snapshot(span).sort((a, b) => a - b);
    const index = Math.min(values.length - 1, Math.max(0, Math.ceil(q * values.length) - 1));
    return values[index] as number;
  }

  private max(span: SpanInternal): number {
    const values = this.snapshot(span);
    let out = 0;
    for (const v of values) if (v > out) out = v;
    return out;
  }
}

export type BudgetHealth = 'ok' | 'warn' | 'alarm';

/**
 * Turns a stream of over-budget frames into a 0-3 state for the overlay.
 * Yellow after a sustained minute of overruns, red after five, so a single GC
 * pause does not cry wolf.
 */
export class BudgetWatcher {
  private streak = 0;
  private longestStreak = 0;

  public update(overBudget: boolean): BudgetHealth {
    if (overBudget) {
      this.streak++;
      if (this.streak > this.longestStreak) this.longestStreak = this.streak;
    } else {
      this.streak = 0;
    }

    if (this.streak >= FRAME.budgetStreakAlarm) return 'alarm';
    if (this.streak >= FRAME.budgetStreakWarn) return 'warn';
    return 'ok';
  }

  public get currentStreak(): number {
    return this.streak;
  }

  public get peakStreak(): number {
    return this.longestStreak;
  }

  public reset(): void {
    this.streak = 0;
    this.longestStreak = 0;
  }
}

/** Budgeted wrapper for one subsystem. Exceeding the budget is reported, not thrown. */
export class Budgeted {
  private readonly watcher = new BudgetWatcher();
  private currentHealth: BudgetHealth = 'ok';

  public constructor(
    private readonly profiler: Profiler,
    private readonly name: string,
    private readonly key: BudgetKey,
  ) {}

  /** Run one unit of work inside the span and report over-budget status. */
  public run<T>(fn: () => T): T {
    this.profiler.begin(this.name, FRAME_BUDGET_MS[this.key]);
    try {
      return fn();
    } finally {
      this.profiler.end();
      this.currentHealth = this.watcher.update(this.profiler.get(this.name)?.overBudget ?? false);
    }
  }

  public get health(): BudgetHealth {
    return this.currentHealth;
  }
}
