import { describe, expect, it } from 'vitest';
import { TileId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { SandSystem } from '../src/world/sand';
import { LiquidType, World } from '../src/world/world';

function arena(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 40; x++) world.setTile(x, 20, TileId.Stone);
  for (let y = 0; y <= 20; y++) {
    world.setTile(0, y, TileId.Stone);
    world.setTile(40, y, TileId.Stone);
  }
  return world;
}

function settle(sand: SandSystem): number {
  let ticks = 0;
  while (sand.activeCells > 0 && ticks < 5000) {
    sand.update(1000);
    ticks++;
  }
  return ticks;
}

function countSand(world: World): number {
  let total = 0;
  for (let i = 0; i < world.fg.length; i++) {
    if (world.fg[i] === TileId.Sand) total++;
  }
  return total;
}

describe('sand', () => {
  it('falls as a column and rests on the floor', () => {
    const world = arena();
    const sand = new SandSystem(world);
    for (let y = 0; y <= 4; y++) {
      world.setTile(10, y, TileId.Sand);
      sand.wake(10, y);
    }

    settle(sand);
    expect(sand.activeCells).toBe(0);
    expect(countSand(world)).toBe(5);
    // The column now sits on top of the floor (rows 15..19).
    for (let y = 15; y <= 19; y++) expect(world.getTile(10, y)).toBe(TileId.Sand);
    expect(world.getTile(10, 14)).toBe(TileId.Air);
  });

  it('leaves no sand floating in the air', () => {
    const world = arena();
    const sand = new SandSystem(world);
    for (let x = 8; x <= 12; x++) {
      for (let y = 0; y <= 6; y++) {
        world.setTile(x, y, TileId.Sand);
        sand.wake(x, y);
      }
    }
    settle(sand);

    for (let x = 1; x <= 39; x++) {
      for (let y = 1; y <= 20; y++) {
        if (world.getTile(x, y) !== TileId.Sand) continue;
        const below = world.getTile(x, y + 1);
        expect(below === TileId.Sand || below !== TileId.Air).toBe(true);
      }
    }
  });

  it('displaces liquid when it falls in, conserving the water', () => {
    const world = arena();
    const sand = new SandSystem(world);
    // A shallow pool on the floor.
    for (let x = 8; x <= 12; x++) world.setLiquid(x, 18, LiquidType.Water, 100);
    const before = world.liquidAmount.reduce((a, b) => a + b, 0);
    // Drop sand into it.
    for (let y = 10; y <= 12; y++) {
      world.setTile(10, y, TileId.Sand);
      sand.wake(10, y);
    }

    settle(sand);
    // Sand sank to the floor; the water moved aside rather than vanishing.
    expect(world.getTile(10, 19)).toBe(TileId.Sand);
    expect(world.liquidAmount.reduce((a, b) => a + b, 0)).toBe(before);
  });

  it('does not let one grain pass through another', () => {
    const world = arena();
    const sand = new SandSystem(world);
    for (let y = 0; y <= 9; y++) {
      world.setTile(20, y, TileId.Sand);
      sand.wake(20, y);
    }
    settle(sand);
    expect(countSand(world)).toBe(10);
  });
});
