import { describe, expect, it } from 'vitest';
import {
  approach,
  chebyshev,
  clamp,
  clamp01,
  distanceSquared,
  formatMs,
  inverseLerp,
  lerp,
  mod,
  rectBottom,
  rectContains,
  rectRight,
  rectsOverlap,
  sign,
  smoothstep,
  snap,
} from '../src/core/math';
import type { Rect } from '../src/core/math';

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

describe('clamp', () => {
  it('pins to both ends and passes values through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles an inverted range by returning the min', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it('clamp01 normalises to 0..1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(2)).toBe(1);
  });
});

describe('lerp and inverseLerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, 0, 0.25)).toBe(7.5);
  });

  it('inverts lerp', () => {
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(10, 0, 2.5)).toBe(0.75);
  });

  it('returns 0 for a degenerate range instead of dividing by zero', () => {
    expect(inverseLerp(5, 5, 5)).toBe(0);
    expect(inverseLerp(5, 5, 9)).toBe(0);
    expect(Number.isNaN(inverseLerp(5, 5, 9))).toBe(false);
  });
});

describe('sign', () => {
  it('returns -1, 0 or 1', () => {
    expect(sign(-3.2)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(3.2)).toBe(1);
  });
});

describe('approach', () => {
  it('moves toward the target by at most maxDelta', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
  });

  it('snaps exactly onto the target', () => {
    expect(approach(0, 2, 5)).toBe(2);
    expect(approach(1.999, 2, 0.001)).toBe(2);
  });

  it('leaves the value alone at the target', () => {
    expect(approach(7, 7, 3)).toBe(7);
  });
});

describe('smoothstep', () => {
  it('eases in and out and clamps out-of-domain input', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
    expect(smoothstep(-3)).toBe(0);
    expect(smoothstep(3)).toBe(1);
  });
});

describe('mod', () => {
  it('is always positive, unlike the % operator', () => {
    expect(mod(7, 3)).toBe(1);
    expect(mod(-1, 3)).toBe(2);
    expect(mod(-7, 3)).toBe(2);
    expect(0 % 3).toBe(0);
  });
});

describe('snap', () => {
  it('rounds to the nearest multiple', () => {
    expect(snap(10, 16)).toBe(16);
    expect(snap(9, 16)).toBe(16);
    expect(snap(24, 16)).toBe(32);
  });
});

describe('rectangles', () => {
  it('exposes edges', () => {
    expect(rectRight(rect(1, 2, 3, 4))).toBe(4);
    expect(rectBottom(rect(1, 2, 3, 4))).toBe(6);
  });

  it('detects overlap, including edge-touching as non-overlap', () => {
    const a = rect(0, 0, 10, 10);
    expect(rectsOverlap(a, rect(5, 5, 10, 10))).toBe(true);
    expect(rectsOverlap(a, rect(10, 0, 10, 10))).toBe(false);
    expect(rectsOverlap(a, rect(-10, 0, 10, 10))).toBe(false);
    expect(rectsOverlap(a, rect(0, 0, 10, 10))).toBe(true);
  });

  it('detects containment', () => {
    const outer = rect(0, 0, 100, 100);
    expect(rectContains(outer, rect(10, 10, 5, 5))).toBe(true);
    expect(rectContains(outer, rect(0, 0, 100, 100))).toBe(true);
    expect(rectContains(outer, rect(95, 95, 10, 10))).toBe(false);
  });
});

describe('distances', () => {
  it('computes squared euclidean distance', () => {
    expect(distanceSquared(0, 0, 3, 4)).toBe(25);
    expect(distanceSquared(-2, -2, 2, 2)).toBe(32);
  });

  it('computes chebyshev distance for simulation radii', () => {
    expect(chebyshev(0, 0, 3, 7)).toBe(7);
    expect(chebyshev(0, 0, -5, -5)).toBe(5);
    expect(chebyshev(0, 0, 0, 0)).toBe(0);
  });
});

describe('formatMs', () => {
  it('formats with two decimals and reports non-finite input', () => {
    expect(formatMs(0.4)).toBe('0.40');
    expect(formatMs(12)).toBe('12.00');
    expect(formatMs(Number.NaN)).toBe('--');
    expect(formatMs(Number.POSITIVE_INFINITY)).toBe('--');
  });
});
