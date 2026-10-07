/**
 * Deterministic pseudo-randomness.
 *
 * Everything here must be reproducible: same seed in, same sequence out, on
 * every machine and every run. World generation, decoration placement and
 * loot all depend on it.
 */

/** FNV-1a over UTF-16 code units, returns an unsigned 32-bit seed. */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const UINT32 = 0x1_0000_0000;

/** 32-bit avalanche mix. */
function mix32(h: number): number {
  let x = h >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Stateless integer hash of (x, y, seed) -> uint32. */
export function hash2i(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h = (h ^ Math.imul(x | 0, 0x27d4eb2d)) >>> 0;
  h = (h ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  return mix32(h);
}

/** Stateless integer hash of (x, y, z, seed) -> uint32. */
export function hash3i(x: number, y: number, z: number, seed: number): number {
  let h = seed >>> 0;
  h = (h ^ Math.imul(x | 0, 0x27d4eb2d)) >>> 0;
  h = (h ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = (h ^ Math.imul(z | 0, 0x9e3779b1)) >>> 0;
  return mix32(h);
}

/** Stateless hash of (x, y, seed) -> [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  return hash2i(x, y, seed) / UINT32;
}

/** Stateless hash of (x, y, z, seed) -> [0, 1). */
export function hash3(x: number, y: number, z: number, seed: number): number {
  return hash3i(x, y, z, seed) / UINT32;
}

/** The classic mulberry32 generator. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/** A seedable random stream. Cheap to fork, so subsystems can take their own. */
export class Rng {
  public readonly seed: number;
  private readonly stream: () => number;

  public constructor(seed: number | string) {
    this.seed = typeof seed === 'string' ? seedFromString(seed) : seed >>> 0;
    this.stream = mulberry32(this.seed);
  }

  /** Float in [0, 1). */
  public next(): number {
    return this.stream();
  }

  /** Integer in [0, maxExclusive). Returns 0 when maxExclusive <= 0. */
  public nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.stream() * maxExclusive);
  }

  /** Integer in [min, maxExclusive). */
  public nextIntRange(min: number, maxExclusive: number): number {
    return min + this.nextInt(Math.max(0, maxExclusive - min));
  }

  /** Float in [min, max). */
  public nextRange(min: number, max: number): number {
    return min + this.stream() * (max - min);
  }

  public chance(probability: number): boolean {
    return this.stream() < probability;
  }

  /** True with probability 1/n. */
  public oneIn(n: number): boolean {
    return this.nextInt(n) === 0;
  }

  public pick<T>(items: readonly T[]): T {
    const item = items[this.nextInt(items.length)];
    if (item === undefined) throw new Error('Rng.pick called with an empty array');
    return item;
  }

  /** In-place Fisher-Yates. Deterministic given the stream state. */
  public shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const a = items[i] as T;
      const b = items[j] as T;
      items[i] = b;
      items[j] = a;
    }
    return items;
  }

  /**
   * A child stream derived from this seed and `salt`. Lets terrain, caves, ores
   * and flora each have an independent, reproducible stream.
   */
  public fork(salt: number | string): Rng {
    const saltValue = typeof salt === 'string' ? seedFromString(salt) : salt >>> 0;
    return new Rng(mix32((this.seed ^ saltValue) >>> 0));
  }
}
