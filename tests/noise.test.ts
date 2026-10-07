import { describe, expect, it } from 'vitest';
import { blob3D, fbm2D, perlin2D, ridged2D, value2D, value3D } from '../src/world/gen/noise';

function inRange(value: number): boolean {
  return value >= 0 && value <= 1;
}

describe('noise', () => {
  it('stays inside [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * -0.21;
      expect(inRange(value2D(x, y, 7))).toBe(true);
      expect(inRange(perlin2D(x, y, 7))).toBe(true);
      expect(inRange(fbm2D(x, y, 7, 4))).toBe(true);
      expect(inRange(ridged2D(x, y, 7, 3))).toBe(true);
      expect(inRange(value3D(x, y, i * 0.1, 7))).toBe(true);
      expect(inRange(blob3D(x, y, i * 0.1, 7))).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(value2D(12.5, -3.25, 99)).toBe(value2D(12.5, -3.25, 99));
    expect(fbm2D(1.5, 2.5, 99)).toBe(fbm2D(1.5, 2.5, 99));
    expect(blob3D(1, 2, 3, 99)).toBe(blob3D(1, 2, 3, 99));
  });

  it('changes with the seed', () => {
    expect(value2D(12.5, -3.25, 1)).not.toBe(value2D(12.5, -3.25, 2));
  });

  it('is continuous between nearby samples', () => {
    const epsilon = 1e-3;
    let max = 0;
    for (let i = 0; i < 500; i++) {
      const x = i * 0.13;
      const y = i * 0.07;
      const a = fbm2D(x, y, 7, 4);
      const b = fbm2D(x + epsilon, y + epsilon, 7, 4);
      max = Math.max(max, Math.abs(a - b));
    }
    expect(max).toBeLessThan(0.01);
  });
});
