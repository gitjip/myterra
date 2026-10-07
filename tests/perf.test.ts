import { describe, expect, it } from 'vitest';
import { Budgeted, BudgetWatcher, Profiler } from '../src/core/perf';
import { FRAME, FRAME_BUDGET_MS } from '../src/data/tuning';

/** Deterministic clock so span durations are exact. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

describe('Profiler', () => {
  it('records a span duration from an explicit clock', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('logic');
    clock.advance(1.5);
    expect(profiler.end()).toBe(1.5);

    const stats = profiler.get('logic');
    expect(stats?.last).toBe(1.5);
    expect(stats?.samples).toBe(1);
  });

  it('nests spans and closes them LIFO', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('outer');
    clock.advance(2);
    profiler.begin('inner');
    clock.advance(3);
    expect(profiler.end()).toBe(3);
    clock.advance(1);
    expect(profiler.end()).toBe(6);

    expect(profiler.get('inner')?.last).toBe(3);
    expect(profiler.get('outer')?.last).toBe(6);
  });

  it('returns 0 from end() when no span is open', () => {
    const profiler = new Profiler(() => 0);
    expect(profiler.end()).toBe(0);
  });

  it('measure returns the callback result and closes the span on throw', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    expect(profiler.measure('render', 8, () => 'value')).toBe('value');
    expect(profiler.get('render')?.samples).toBe(1);

    expect(() =>
      profiler.measure('render', 8, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    // Span count did not leak, so a throwing subsystem cannot corrupt the frame.
    expect(profiler.get('render')?.samples).toBe(2);
  });

  it('computes avg, p95 and max over the rolling window', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now, 100);
    for (let i = 1; i <= 100; i++) {
      profiler.begin('tick');
      clock.advance(i);
      profiler.end();
    }
    const stats = profiler.get('tick');
    expect(stats?.samples).toBe(100);
    expect(stats?.avg).toBeCloseTo(50.5, 6);
    expect(stats?.max).toBe(100);
    expect(stats?.p95).toBe(95);
  });

  it('evicts the oldest samples once the window is full', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now, 4);
    for (let i = 0; i < 10; i++) {
      profiler.begin('tick');
      clock.advance(10);
      profiler.end();
    }
    const stats = profiler.get('tick');
    expect(stats?.samples).toBe(4);
    expect(stats?.avg).toBeCloseTo(10, 6);
    expect(stats?.max).toBeCloseTo(10, 6);
  });

  it('flags spans against their budget', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('liquid', 2);
    clock.advance(5);
    profiler.end();
    expect(profiler.get('liquid')?.overBudget).toBe(true);
    expect(profiler.get('liquid')?.avgOverBudget).toBe(true);

    profiler.begin('sand', 1);
    clock.advance(0.2);
    profiler.end();
    expect(profiler.get('sand')?.overBudget).toBe(false);
    expect(profiler.get('sand')?.budget).toBe(1);
  });

  it('treats a span with no budget as never over', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('freeform');
    clock.advance(1000);
    profiler.end();
    const stats = profiler.get('freeform');
    expect(stats?.budget).toBeNull();
    expect(stats?.overBudget).toBe(false);
  });

  it('sorts stats by average time, slowest first', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    for (const [name, ms] of [
      ['a', 1],
      ['b', 9],
      ['c', 5],
    ] as const) {
      profiler.begin(name);
      clock.advance(ms);
      profiler.end();
    }
    expect(profiler.stats().map((s) => s.name)).toEqual(['b', 'c', 'a']);
  });

  it('never reports a negative duration', () => {
    let t = 100;
    const profiler = new Profiler(() => (t -= 5));
    profiler.begin('weird');
    expect(profiler.end()).toBe(0);
  });

  it('clearWindow keeps spans registered but drops samples', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('logic');
    clock.advance(3);
    profiler.end();
    profiler.clearWindow();
    expect(profiler.get('logic')?.samples).toBe(0);
    expect(profiler.get('logic')?.last).toBe(0);
  });

  it('reset removes spans entirely', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    profiler.begin('logic');
    profiler.end();
    profiler.reset();
    expect(profiler.get('logic')).toBeUndefined();
  });
});

describe('BudgetWatcher', () => {
  it('stays ok, then warns after the sustained streak, then alarms', () => {
    const watcher = new BudgetWatcher();
    expect(watcher.update(false)).toBe('ok');
    for (let i = 0; i < FRAME.budgetStreakWarn - 1; i++) expect(watcher.update(true)).toBe('ok');
    expect(watcher.update(true)).toBe('warn');
    for (let i = 0; i < FRAME.budgetStreakAlarm - FRAME.budgetStreakWarn - 1; i++) {
      expect(watcher.update(true)).toBe('warn');
    }
    expect(watcher.update(true)).toBe('alarm');
  });

  it('a single good frame clears the streak', () => {
    const watcher = new BudgetWatcher();
    for (let i = 0; i < FRAME.budgetStreakWarn; i++) watcher.update(true);
    expect(watcher.currentStreak).toBe(FRAME.budgetStreakWarn);
    expect(watcher.update(false)).toBe('ok');
    expect(watcher.currentStreak).toBe(0);
    expect(watcher.update(true)).toBe('ok');
  });

  it('remembers the peak streak', () => {
    const watcher = new BudgetWatcher();
    for (let i = 0; i < 12; i++) watcher.update(true);
    watcher.update(false);
    expect(watcher.peakStreak).toBe(12);
    watcher.reset();
    expect(watcher.peakStreak).toBe(0);
  });
});

describe('Budgeted', () => {
  it('registers its span with the configured budget', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    const budgeted = new Budgeted(profiler, 'liquid', 'liquid');
    budgeted.run(() => {
      clock.advance(0.5);
    });
    const stats = profiler.get('liquid');
    expect(stats?.budget).toBe(FRAME_BUDGET_MS.liquid);
    expect(stats?.last).toBe(0.5);
    expect(budgeted.health).toBe('ok');
  });

  it('escalates its health when it keeps overrunning', () => {
    const clock = fakeClock();
    const profiler = new Profiler(clock.now);
    const budgeted = new Budgeted(profiler, 'render', 'render');
    for (let i = 0; i < FRAME.budgetStreakWarn; i++) {
      budgeted.run(() => {
        clock.advance(FRAME_BUDGET_MS.render + 1);
      });
    }
    expect(budgeted.health).toBe('warn');
  });
});
