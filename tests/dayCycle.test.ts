import { describe, expect, it } from 'vitest';
import { LIGHT } from '../src/data/tuning';
import { advanceDay, dayFactorFor, daylight, skyColorFor } from '../src/world/dayCycle';

describe('day cycle', () => {
  it('is brightest at noon and dark at midnight', () => {
    expect(daylight(0.25)).toBeCloseTo(1, 5);
    expect(daylight(0.75)).toBeCloseTo(0, 5);
    expect(dayFactorFor(0.25)).toBeCloseTo(LIGHT.dayFactorDay, 5);
    expect(dayFactorFor(0.75)).toBeCloseTo(LIGHT.dayFactorNight, 5);
  });

  it('advances and wraps at midnight', () => {
    const quarter = advanceDay(0.5, 3, LIGHT.dayCycleSeconds / 4);
    expect(quarter.timeOfDay).toBeCloseTo(0.75, 6);
    expect(quarter.dayCount).toBe(3);

    const wrapped = advanceDay(quarter.timeOfDay, quarter.dayCount, LIGHT.dayCycleSeconds / 4);
    expect(wrapped.timeOfDay).toBeCloseTo(0, 6);
    expect(wrapped.dayCount).toBe(4);
  });

  it('returns a colour for any time', () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const color = skyColorFor(t);
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);
    }
    expect(skyColorFor(0.25).b).toBeGreaterThan(skyColorFor(0.75).b);
  });
});
