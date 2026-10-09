import { describe, expect, it } from 'vitest';
import { TimeControl } from '../src/game/timeControl';

describe('TimeControl', () => {
  it('runs every step while unpaused', () => {
    const time = new TimeControl();
    expect(time.isPaused).toBe(false);
    expect(time.shouldStep()).toBe(true);
  });

  it('freezes and consumes queued steps', () => {
    const time = new TimeControl();
    time.setPaused(true);
    expect(time.shouldStep()).toBe(false);

    time.requestStep(2);
    expect(time.shouldStep()).toBe(true);
    expect(time.shouldStep()).toBe(true);
    expect(time.shouldStep()).toBe(false);
    expect(time.isPaused).toBe(true);
  });

  it('resuming clears the queue', () => {
    const time = new TimeControl();
    time.requestStep(5);
    time.setPaused(false);
    expect(time.stepsRemaining).toBe(0);
    expect(time.shouldStep()).toBe(true);
  });

  it('toggles pause state', () => {
    const time = new TimeControl();
    expect(time.toggle()).toBe(true);
    expect(time.toggle()).toBe(false);
  });
});
