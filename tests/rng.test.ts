import { describe, expect, it } from 'vitest';
import {
  UINT32,
  Rng,
  hash2,
  hash2i,
  hash3,
  hash3i,
  mulberry32,
  seedFromString,
} from '../src/core/rng';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let differences = 0;
    for (let i = 0; i < 100; i++) if (a() !== b()) differences++;
    expect(differences).toBeGreaterThan(90);
  });

  it('stays inside [0, 1)', () => {
    const next = mulberry32(0xdeadbeef);
    for (let i = 0; i < 100_000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a roughly uniform distribution', () => {
    const next = mulberry32(7);
    const buckets = new Array<number>(10).fill(0);
    const samples = 100_000;
    for (let i = 0; i < samples; i++) {
      const bucket = Math.min(9, Math.floor(next() * 10));
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    const expected = samples / 10;
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });
});

describe('hash functions', () => {
  it('are deterministic and in [0, 1)', () => {
    for (let i = 0; i < 10_000; i++) {
      const x = i * 37 - 5000;
      const y = i * -13 + 2500;
      expect(hash2(x, y, 99)).toBe(hash2(x, y, 99));
      const h = hash2(x, y, 99);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(hash3(x, y, i, 99)).toBe(hash3(x, y, i, 99));
    }
  });

  it('stay inside uint32 for the raw integer form', () => {
    for (let i = 0; i < 10_000; i++) {
      const v = hash2i(i, -i, i ^ 0x5f3759df);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(UINT32);
      expect(hash3i(i, -i, i, 3)).toBeLessThan(UINT32);
    }
  });

  it('decorrelate adjacent cells', () => {
    // Neighbouring tiles get near-independent noise; otherwise terrain bands
    // would show visible diagonals.
    let close = 0;
    const samples = 5000;
    for (let i = 0; i < samples; i++) {
      if (Math.abs(hash2(i, 0, 42) - hash2(i + 1, 0, 42)) < 0.1) close++;
    }
    // Independent uniform values are within 0.1 about 19% of the time.
    expect(close / samples).toBeGreaterThan(0.15);
    expect(close / samples).toBeLessThan(0.23);
  });

  it('change when the seed changes', () => {
    const a = hash2i(10, 10, 1);
    const b = hash2i(10, 10, 2);
    expect(a).not.toBe(b);
  });
});

describe('seedFromString', () => {
  it('is stable for the same text', () => {
    expect(seedFromString('myterra')).toBe(seedFromString('myterra'));
  });

  it('differs for different text, including case', () => {
    expect(seedFromString('MyTerra')).not.toBe(seedFromString('myterra'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const text of ['', 'a', 'hello world', '种子']) {
      const s = seedFromString(text);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(UINT32);
    }
  });
});

describe('Rng', () => {
  it('accepts a number or a string seed and reports the resolved seed', () => {
    expect(new Rng(99).seed).toBe(99);
    expect(new Rng('myterra').seed).toBe(seedFromString('myterra'));
  });

  it('is deterministic across instances with the same seed', () => {
    const a = new Rng('world');
    const b = new Rng('world');
    for (let i = 0; i < 500; i++) expect(a.next()).toBe(b.next());
  });

  it('nextInt stays in range', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextInt(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('nextInt returns 0 for a non-positive bound instead of throwing', () => {
    const rng = new Rng(4);
    expect(rng.nextInt(0)).toBe(0);
    expect(rng.nextInt(-3)).toBe(0);
  });

  it('nextIntRange is inclusive of min and exclusive of max', () => {
    const rng = new Rng(11);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.nextIntRange(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('nextRange stays in bounds', () => {
    const rng = new Rng(12);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextRange(-2.5, 2.5);
      expect(v).toBeGreaterThanOrEqual(-2.5);
      expect(v).toBeLessThan(2.5);
    }
  });

  it('chance and oneIn respect their probability', () => {
    const rng = new Rng(13);
    let hits = 0;
    for (let i = 0; i < 20_000; i++) if (rng.chance(0.25)) hits++;
    expect(hits / 20_000).toBeGreaterThan(0.23);
    expect(hits / 20_000).toBeLessThan(0.27);

    let tenth = 0;
    for (let i = 0; i < 20_000; i++) if (rng.oneIn(10)) tenth++;
    expect(tenth / 20_000).toBeGreaterThan(0.09);
    expect(tenth / 20_000).toBeLessThan(0.11);
  });

  it('pick returns members and throws on an empty array', () => {
    const rng = new Rng(14);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 500; i++) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow();
  });

  it('shuffle is deterministic and a permutation', () => {
    const a = new Rng(15).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = new Rng(15).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('fork derives independent but reproducible streams', () => {
    const root = new Rng('world');
    const terrain = root.fork('terrain');
    const caves = root.fork('caves');
    expect(terrain.seed).toBe(new Rng('world').fork('terrain').seed);
    expect(terrain.seed).not.toBe(caves.seed);

    const left = root.fork(1).next();
    const right = root.fork(1).next();
    expect(left).toBe(right);
  });
});
