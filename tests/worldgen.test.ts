import { describe, expect, it } from 'vitest';
import { GEN, WORLD } from '../src/data/tuning';
import { TileId } from '../src/data/tiles';
import { findSpawn, WorldGenerator } from '../src/world/gen/generator';
import { surfaceAt } from '../src/world/gen/terrain';
import type { World } from '../src/world/world';

const WIDTH = WORLD.minReachWidth;

function generate(seed: number): World {
  return new WorldGenerator(seed, WIDTH).runToCompletion();
}

function hashWorld(world: World): number {
  let hash = 0x811c9dc5;
  for (const array of [world.fg, world.wall, world.liquidType, world.liquidAmount]) {
    for (let i = 0; i < array.length; i++) {
      hash ^= array[i] as number;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

describe('world generation', () => {
  it('is deterministic for the same (genVersion, seed, width)', () => {
    expect(GEN.genVersion).toBeGreaterThan(0);
    expect(hashWorld(generate(12345))).toBe(hashWorld(generate(12345)));
  });

  it('differs for a different seed', () => {
    expect(hashWorld(generate(1))).not.toBe(hashWorld(generate(2)));
  });

  it('keeps the surface height continuous across columns', () => {
    let maxJump = 0;
    for (let x = 1; x < WIDTH; x++) {
      maxJump = Math.max(maxJump, Math.abs(surfaceAt(x, 7) - surfaceAt(x - 1, 7)));
    }
    expect(maxJump).toBeLessThanOrEqual(6);
  });

  it('lays bedrock across the bottom row', () => {
    const world = generate(3);
    for (let x = 0; x < WIDTH; x += 97) {
      expect(world.getTile(x, WORLD.yMax)).toBe(TileId.Bedrock);
    }
  });

  it('grows trees with supported trunks and leaves', () => {
    const world = generate(42);
    let trunks = 0;
    let floatingLeaves = 0;
    for (let x = 0; x < WIDTH; x++) {
      for (let y: number = WORLD.yReachMin; y <= WORLD.yReachMax; y++) {
        const tile = world.getTile(x, y);
        if (tile === TileId.Wood) trunks++;
        if (tile === TileId.Leaf) {
          const connected =
            world.getTile(x - 1, y) !== TileId.Air ||
            world.getTile(x + 1, y) !== TileId.Air ||
            world.getTile(x, y - 1) !== TileId.Air ||
            world.getTile(x, y + 1) !== TileId.Air;
          if (!connected) floatingLeaves++;
        }
      }
    }
    expect(trunks).toBeGreaterThan(0);
    expect(floatingLeaves).toBe(0);
  });

  it('carves caves and fills some pools', () => {
    const world = generate(7);
    let caves = 0;
    let liquid = 0;
    for (let x = 0; x < WIDTH; x += 3) {
      const surface = surfaceAt(x, 7);
      for (let y = surface + 6; y < WORLD.yMax - GEN.bedrockMargin; y++) {
        if (world.getTile(x, y) === TileId.Air) caves++;
        if (world.liquidAt(x, y).amount > 0) liquid++;
      }
    }
    expect(caves).toBeGreaterThan(0);
    expect(liquid).toBeGreaterThan(0);
  });

  it('places ores inside the generation depth window', () => {
    const world = generate(11);
    const ores = new Set<TileId>([TileId.CoalOre, TileId.IronOre, TileId.GoldOre]);
    let count = 0;
    for (let x = 0; x < WIDTH; x += 2) {
      const surface = surfaceAt(x, 11);
      for (let y = surface; y < WORLD.yMax; y++) {
        if (!ores.has(world.getTile(x, y))) continue;
        count++;
        const depth = y - surface;
        expect(depth).toBeGreaterThanOrEqual(GEN.coalBand[0]);
        expect(depth).toBeLessThanOrEqual(GEN.goldBand[1]);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('grows distinct surface tiles for all four biomes', () => {
    const world = generate(9);
    const present = new Set<TileId>();
    for (let x = 0; x < WIDTH; x += 2) {
      for (let y: number = WORLD.yReachMin; y <= WORLD.yReachMax; y++) {
        present.add(world.getTile(x, y));
      }
    }
    for (const tile of [
      TileId.Grass,
      TileId.Sand,
      TileId.Sandstone,
      TileId.Cactus,
      TileId.Snow,
      TileId.Ice,
      TileId.JungleGrass,
      TileId.Hardwood,
    ]) {
      expect(present.has(tile)).toBe(true);
    }
  });

  it('finds a spawn with three air rows above solid ground', () => {
    const world = generate(5);
    const spawn = findSpawn(world);
    expect(world.inReach(spawn.x, spawn.y)).toBe(true);
    expect(world.isSolid(spawn.x, spawn.y)).toBe(true);
    expect(world.isSolid(spawn.x, spawn.y - 1)).toBe(false);
    expect(world.isSolid(spawn.x, spawn.y - 2)).toBe(false);
    expect(world.isSolid(spawn.x, spawn.y - 3)).toBe(false);
  });
});
