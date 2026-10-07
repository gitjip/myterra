import { describe, expect, it } from 'vitest';
import { TileId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { LiquidSystem } from '../src/world/liquid';
import { LiquidType, World } from '../src/world/world';

function basin(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 40; x++) world.setTile(x, 20, TileId.Stone);
  for (let y = 0; y <= 20; y++) {
    world.setTile(0, y, TileId.Stone);
    world.setTile(40, y, TileId.Stone);
  }
  return world;
}

function settle(liquid: LiquidSystem): number {
  let ticks = 0;
  while (liquid.activeCells > 0 && ticks < 5000) {
    liquid.update(1000);
    ticks++;
  }
  return ticks;
}

function totalLiquid(world: World): number {
  let total = 0;
  for (let i = 0; i < world.liquidAmount.length; i++) total += world.liquidAmount[i] ?? 0;
  return total;
}

describe('liquid', () => {
  it('settles to zero active cells and conserves volume', () => {
    const world = basin();
    const liquid = new LiquidSystem(world);
    for (let x = 1; x <= 39; x++) world.setLiquid(x, 19, LiquidType.Water, 100);
    const before = totalLiquid(world);
    liquid.rebuildActive();

    settle(liquid);
    expect(liquid.activeCells).toBe(0);
    expect(totalLiquid(world)).toBe(before);
    // A single bottom row cannot hold 39 full cells without spreading upward.
    expect(world.getTile(20, 18)).toBe(TileId.Air);
  });

  it('falls to the floor', () => {
    const world = basin();
    const liquid = new LiquidSystem(world);
    world.setLiquid(20, 2, LiquidType.Water, 100);
    liquid.wakeNeighbourhood(20, 2);

    settle(liquid);
    expect(world.liquidAmount[world.idx(20, 19)] ?? 0).toBeGreaterThan(0);
    expect(world.liquidAmount[world.idx(20, 2)] ?? 0).toBe(0);
  });

  it('turns water and lava into obsidian and stone', () => {
    const world = basin();
    const liquid = new LiquidSystem(world);
    world.setLiquid(10, 19, LiquidType.Lava, 100);
    world.setLiquid(11, 19, LiquidType.Water, 100);
    liquid.wakeNeighbourhood(10, 19);
    liquid.wakeNeighbourhood(11, 19);

    settle(liquid);
    const a = world.getTile(10, 19);
    const b = world.getTile(11, 19);
    expect([a, b].some((t) => t === TileId.Obsidian)).toBe(true);
    expect([a, b].some((t) => t === TileId.Stone)).toBe(true);
    expect(world.liquidAmount[world.idx(10, 19)] ?? 0).toBe(0);
    expect(world.liquidAmount[world.idx(11, 19)] ?? 0).toBe(0);
  });

  it('spreads horizontally across the floor', () => {
    const world = basin();
    const liquid = new LiquidSystem(world);
    world.setLiquid(20, 19, LiquidType.Water, 100);
    liquid.wakeNeighbourhood(20, 19);

    settle(liquid);
    expect(liquid.activeCells).toBe(0);
    expect(world.liquidAmount[world.idx(19, 19)] ?? 0).toBeGreaterThan(0);
    expect(world.liquidAmount[world.idx(21, 19)] ?? 0).toBeGreaterThan(0);
  });
});
