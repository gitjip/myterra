import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ItemId } from '../src/data/items';
import { TileId } from '../src/data/tiles';
import { GEN, WORLD } from '../src/data/tuning';
import { applySave, encodeSave, readSaveHeader } from '../src/save/apply';
import type { SaveState } from '../src/save/apply';
import { LiquidType, World } from '../src/world/world';

function baseline(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x < 320; x++) {
    for (let y = 0; y < 64; y++) {
      world.setTile(x, y, y < 32 ? TileId.Dirt : TileId.Stone);
    }
  }
  world.clearDirty();
  return world;
}

function state(world: World, overrides: Partial<SaveState> = {}): SaveState {
  return {
    world,
    seed: 7,
    mode: 'survival',
    timeOfDay: 0.3,
    dayCount: 2,
    spawnX: 11,
    spawnY: 22,
    createdAt: 123456,
    playedMs: 654321,
    player: { x: 1, y: 2, vx: 3, vy: 4, health: 70, hunger: 60, breath: 50, facing: -1 },
    inventory: {
      slots: [{ item: ItemId.Dirt, count: 30 }, null, { item: ItemId.WoodAxe, count: 1 }],
      equipment: [null, null, null, { item: ItemId.Arrow, count: 20 }],
    },
    chests: [
      {
        x: 4,
        y: 9,
        slots: [{ item: ItemId.Stone, count: 15 }, null],
      },
    ],
    ...overrides,
  };
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

describe('save round-trip', () => {
  it('restores tiles, liquid, player and inventory exactly', () => {
    const source = baseline();
    source.setTile(5, 5, TileId.Wood);
    source.setTile(6, 6, TileId.DoorBottomOpen);
    source.setLiquid(7, 7, LiquidType.Water, 42);
    source.setLiquid(8, 8, LiquidType.Lava, 100);

    const bytes = encodeSave(state(source));
    const target = baseline();
    const loaded = applySave(target, bytes);

    expect(arraysEqual(source.fg, target.fg)).toBe(true);
    expect(arraysEqual(source.liquidType, target.liquidType)).toBe(true);
    expect(arraysEqual(source.liquidAmount, target.liquidAmount)).toBe(true);
    expect(loaded.mode).toBe('survival');
    expect(loaded.dayCount).toBe(2);
    expect(loaded.player).toEqual(state(source).player);
    expect(loaded.inventory).toEqual(state(source).inventory);
    expect(loaded.chests).toEqual(state(source).chests);
    expect(readSaveHeader(bytes).seed).toBe(7);
  });

  it('round-trips 100k scattered edits', () => {
    const rng = new Rng(99);
    const source = baseline();
    const width = source.width;
    for (let i = 0; i < 100_000; i++) {
      const index = rng.nextInt(width * source.height);
      const x = source.xMin + (index % width);
      const y = source.yMin + Math.floor(index / width);
      source.setTile(x, y, rng.nextInt(3) === 0 ? TileId.Air : TileId.Stone);
    }

    const bytes = encodeSave(state(source));
    const target = baseline();
    applySave(target, bytes);
    expect(arraysEqual(source.fg, target.fg)).toBe(true);
  });

  it('writes a near-empty save for an unmodified world', () => {
    const bytes = encodeSave(state(baseline()));
    expect(bytes.length).toBeLessThan(1024);
  });

  it('round-trips the game mode flag', () => {
    const bytes = encodeSave(state(baseline(), { mode: 'creative' }));
    expect(applySave(baseline(), bytes).mode).toBe('creative');
  });
});

describe('save validation', () => {
  it('rejects an unsupported save version', () => {
    const bytes = encodeSave(state(baseline()));
    new DataView(bytes.buffer).setUint16(4, 99, true);
    expect(() => applySave(baseline(), bytes)).toThrow(/unsupported save version/);
  });

  it('rejects a generator version mismatch', () => {
    const bytes = encodeSave(state(baseline()));
    new DataView(bytes.buffer).setUint16(6, GEN.genVersion + 1, true);
    expect(() => applySave(baseline(), bytes)).toThrow(/generator version mismatch/);
  });

  it('rejects a truncated blob', () => {
    const bytes = encodeSave(state(baseline())).slice(0, 6);
    expect(() => readSaveHeader(bytes)).toThrow(/truncated/);
  });

  it('rejects a bad magic number', () => {
    const bytes = encodeSave(state(baseline()));
    new DataView(bytes.buffer).setUint32(0, 0xdeadbeef, true);
    expect(() => readSaveHeader(bytes)).toThrow(/bad magic/);
  });
});
