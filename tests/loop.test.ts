import { describe, expect, it, vi } from 'vitest';
import { FixedStepRunner, GameLoop } from '../src/core/loop';
import type { RenderInfo } from '../src/core/loop';
import { FRAME } from '../src/data/tuning';

const DT = FRAME.fixedDt;

describe('FixedStepRunner', () => {
  it('runs no step for a delta shorter than one tick', () => {
    const runner = new FixedStepRunner();
    const result = runner.advance(DT * 0.5);
    expect(result.steps).toBe(0);
    expect(result.alpha).toBeCloseTo(0.5, 10);
  });

  it('accumulates sub-tick deltas until a full step is owed', () => {
    const runner = new FixedStepRunner();
    expect(runner.advance(DT * 0.6).steps).toBe(0);
    expect(runner.advance(DT * 0.6).steps).toBe(1);
    expect(runner.advance(DT * 0.6).steps).toBe(0);
  });

  it('runs exactly one step per 60 Hz', () => {
    const runner = new FixedStepRunner();
    for (let i = 0; i < 600; i++) {
      expect(runner.advance(DT).steps).toBe(1);
    }
  });

  it('keeps alpha in [0, 1) when caught up', () => {
    const runner = new FixedStepRunner();
    const { alpha } = runner.advance(DT * 3);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('clamps a long stall to maxAccumulatedSeconds', () => {
    const runner = new FixedStepRunner();
    const result = runner.advance(30);
    expect(result.steps).toBeLessThanOrEqual(FRAME.maxStepsPerFrame);
    expect(runner.pending).toBeLessThanOrEqual(FRAME.maxAccumulatedSeconds);
  });

  it('caps steps per frame and discards the backlog (no death spiral)', () => {
    const runner = new FixedStepRunner();
    const result = runner.advance(FRAME.maxAccumulatedSeconds);
    expect(result.steps).toBe(FRAME.maxStepsPerFrame);
    expect(result.discarded).toBeGreaterThan(0);
    expect(runner.pending).toBe(0);
  });

  it('treats zero, negative and NaN deltas as no time passing', () => {
    const runner = new FixedStepRunner();
    expect(runner.advance(0).steps).toBe(0);
    expect(runner.advance(-1).steps).toBe(0);
    expect(runner.advance(Number.NaN).steps).toBe(0);
    expect(runner.pending).toBe(0);
  });

  it('reset drops pending time', () => {
    const runner = new FixedStepRunner();
    runner.advance(DT * 0.75);
    expect(runner.pending).toBeCloseTo(DT * 0.75, 10);
    runner.reset();
    expect(runner.pending).toBe(0);
  });

  it('simulates exactly 60 seconds of time in 3600 real-time seconds', () => {
    const runner = new FixedStepRunner();
    let steps = 0;
    for (let frame = 0; frame < 60 * 60; frame++) steps += runner.advance(1 / 60).steps;
    expect(steps).toBe(60 * 60);
  });
});

describe('GameLoop', () => {
  interface Harness {
    loop: GameLoop;
    fixedUpdate: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    setHidden: ReturnType<typeof vi.fn>;
    advanceTime(ms: number): void;
    frames: number;
  }

  function harness(): Harness {
    const fixedUpdate = vi.fn();
    const render = vi.fn();
    const setHidden = vi.fn();
    let time = 0;
    let pending: ((t: number) => void) | undefined;
    let frames = 0;

    const loop = new GameLoop(
      { fixedUpdate, render, visibilityChanged: setHidden },
      {
        now: () => time,
        requestFrame: (callback) => {
          pending = callback;
          return ++frames;
        },
        cancelFrame: () => undefined,
      },
    );

    return {
      loop,
      fixedUpdate,
      render,
      setHidden,
      advanceTime(ms: number) {
        time += ms;
        const callback = pending;
        if (!callback) return;
        pending = undefined;
        callback(time);
      },
      get frames() {
        return frames;
      },
    };
  }

  it('drives fixed updates at exactly the fixed timestep', () => {
    const h = harness();
    h.loop.start();
    for (let i = 0; i < 10; i++) h.advanceTime(1000 / 60);
    expect(h.fixedUpdate).toHaveBeenCalledTimes(10);
    expect(h.fixedUpdate).toHaveBeenLastCalledWith(DT);
    expect(h.render).toHaveBeenCalledTimes(10);
  });

  it('renders exactly once per animation frame regardless of step count', () => {
    const h = harness();
    h.loop.start();
    h.advanceTime(100); // ~6 steps
    expect(h.fixedUpdate.mock.calls.length).toBe(FRAME.maxStepsPerFrame);
    expect(h.render).toHaveBeenCalledTimes(1);
  });

  it('passes alpha, realDelta and step count to the renderer', () => {
    const h = harness();
    h.loop.start();
    h.advanceTime(1000 / 30);
    const info = h.render.mock.calls[0]?.[0] as RenderInfo | undefined;
    expect(info).toBeDefined();
    if (!info) return;
    expect(info.frameIndex).toBe(1);
    expect(info.realDelta).toBeCloseTo(1 / 30, 6);
    expect(info.steps).toBe(2);
    expect(info.alpha).toBeGreaterThanOrEqual(0);
    expect(info.alpha).toBeLessThan(1);
  });

  it('does not simulate while hidden, then catches up cleanly', () => {
    const h = harness();
    h.loop.start();
    h.advanceTime(1000 / 60);
    const before = h.fixedUpdate.mock.calls.length;

    h.loop.setHidden(true);
    expect(h.setHidden).toHaveBeenCalledWith(true);
    h.advanceTime(5000);
    expect(h.fixedUpdate.mock.calls.length).toBe(before);

    h.loop.setHidden(false);
    h.advanceTime(1000 / 60);
    expect(h.fixedUpdate.mock.calls.length).toBe(before + 1);
  });

  it('ignores repeated identical visibility changes', () => {
    const h = harness();
    h.loop.start();
    h.loop.setHidden(true);
    h.loop.setHidden(true);
    expect(h.setHidden).toHaveBeenCalledTimes(1);
  });

  it('start is idempotent and stop halts the loop', () => {
    const h = harness();
    h.loop.start();
    h.loop.start();
    expect(h.loop.isRunning).toBe(true);
    h.advanceTime(1000 / 60);
    const count = h.fixedUpdate.mock.calls.length;

    h.loop.stop();
    expect(h.loop.isRunning).toBe(false);
    h.advanceTime(1000 / 60);
    expect(h.fixedUpdate.mock.calls.length).toBe(count);
  });
});
