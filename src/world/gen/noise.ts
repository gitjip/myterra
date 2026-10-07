import { hash2, hash2i, hash3 } from '../../core/rng';

/**
 * Deterministic, world-coordinate noise. Every function is a pure mapping from
 * continuous coordinates and a seed, so chunks generated independently agree
 * exactly across their shared boundary.
 */

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise. Returns [0, 1]. */
export function value2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);

  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);

  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

/** Trilinear value noise. Returns [0, 1]. */
export function value3D(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const tz = smooth(z - z0);

  const c000 = hash3(x0, y0, z0, seed);
  const c100 = hash3(x0 + 1, y0, z0, seed);
  const c010 = hash3(x0, y0 + 1, z0, seed);
  const c110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const c001 = hash3(x0, y0, z0 + 1, seed);
  const c101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const c011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const c111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);

  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;
  const y0v = x00 + (x10 - x00) * ty;
  const y1v = x01 + (x11 - x01) * ty;
  return y0v + (y1v - y0v) * tz;
}

const GRADIENT_X = new Float64Array([
  1, -1, 0, 0, 0.7071067811865476, -0.7071067811865476, 0.7071067811865476, -0.7071067811865476,
]);
const GRADIENT_Y = new Float64Array([
  0, 0, 1, -1, 0.7071067811865476, 0.7071067811865476, -0.7071067811865476, -0.7071067811865476,
]);

function gradient(ix: number, iy: number, seed: number, dx: number, dy: number): number {
  const index = hash2i(ix, iy, seed) & 7;
  return (GRADIENT_X[index] as number) * dx + (GRADIENT_Y[index] as number) * dy;
}

/** Gradient (Perlin) noise, normalised to [0, 1]. */
export function perlin2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const u = smooth(dx);
  const v = smooth(dy);

  const n00 = gradient(x0, y0, seed, dx, dy);
  const n10 = gradient(x0 + 1, y0, seed, dx - 1, dy);
  const n01 = gradient(x0, y0 + 1, seed, dx, dy - 1);
  const n11 = gradient(x0 + 1, y0 + 1, seed, dx - 1, dy - 1);

  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 0.5 + 0.5;
}

/** Fractal Brownian motion over value noise. Returns [0, 1]. */
export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += value2D(x * frequency, y * frequency, seed + i * 101) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal. High values sit on the tunnel crests. Returns [0, 1]. */
export function ridged2D(x: number, y: number, seed: number, octaves = 3): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = perlin2D(x * frequency, y * frequency, seed + i * 131);
    const ridge = 1 - Math.abs(n * 2 - 1);
    sum += ridge * ridge * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/** Low-frequency 3D blobs, used for caverns and ore veins. Returns [0, 1]. */
export function blob3D(x: number, y: number, z: number, seed: number): number {
  return value3D(x, y, z, seed);
}

/** 1D convenience over fbm2D, for height fields. Returns [0, 1]. */
export function fbm1D(x: number, seed: number, octaves = 4): number {
  return fbm2D(x, 0, seed, octaves);
}
