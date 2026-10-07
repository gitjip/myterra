import { describe, expect, it } from 'vitest';
import { TileId, WallId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { createTestWorld } from '../src/world/testWorld';
import { LiquidType, World } from '../src/world/world';

describe('World', () => {
  it('allocates six resident arrays with buffered horizontal coordinates', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    expect(world.xMin).toBe(-128);
    expect(world.xMax).toBe(WORLD.minReachWidth + 127);
    expect(world.width).toBe(WORLD.minReachWidth + 256);
    expect(world.height).toBe(1024);
    for (const array of [
      world.fg,
      world.wall,
      world.skyDepth,
      world.blockLight,
      world.liquidType,
      world.liquidAmount,
    ]) {
      expect(array.length).toBe(world.width * world.height);
    }
  });

  it('clamps indexes at all four world edges', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    expect(world.idx(world.xMin, world.yMin)).toBe(0);
    expect(world.idx(world.xMax, world.yMax)).toBe(world.fg.length - 1);
    expect(world.idx(-9999, -9999)).toBe(0);
    expect(world.idx(9999, 9999)).toBe(world.fg.length - 1);
  });

  it('keeps reach separate from the buffer and rejects fractional coordinates', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    expect(world.inReach(0, WORLD.yReachMin)).toBe(true);
    expect(world.inReach(world.reachWidth - 1, WORLD.yReachMax)).toBe(true);
    expect(world.inReach(-1, 0)).toBe(false);
    expect(world.inReach(world.reachWidth, 0)).toBe(false);
    expect(world.inReach(0, WORLD.yMin)).toBe(false);
    expect(world.inReach(0, WORLD.yMax)).toBe(false);
    expect(world.inReach(0.5, 0)).toBe(false);
  });

  it('updates tiles, walls and revision through their public setters', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    const before = world.revision;
    world.setTile(0, 0, TileId.Stone);
    world.setWall(0, 0, WallId.Dirt);
    expect(world.getTile(0, 0)).toBe(TileId.Stone);
    expect(world.getWall(0, 0)).toBe(WallId.Dirt);
    expect(world.revision).toBe(before + 2);
    world.setTile(0, 0, TileId.Stone);
    expect(world.revision).toBe(before + 2);
  });

  it('clamps liquid amounts and clears liquid when a solid tile is placed', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    world.setLiquid(2, 2, LiquidType.Water, 150);
    expect(world.liquidAt(2, 2)).toEqual({ type: LiquidType.Water, amount: 100 });
    world.setTile(2, 2, TileId.Stone);
    expect(world.liquidAt(2, 2)).toEqual({ type: LiquidType.None, amount: 0 });
    world.setLiquid(2, 2, LiquidType.Lava, -5);
    expect(world.liquidAt(2, 2)).toEqual({ type: LiquidType.None, amount: 0 });
  });

  it('creates the deterministic M1 flat test scene', () => {
    const world = createTestWorld(WORLD.minReachWidth);
    expect(world.getTile(0, 16)).toBe(TileId.Grass);
    expect(world.getTile(0, 17)).toBe(TileId.Dirt);
    expect(world.getTile(0, 20)).toBe(TileId.Stone);
    expect(world.getTile(0, 63)).toBe(TileId.Bedrock);
    expect(world.getTile(0, 0)).toBe(TileId.Air);
    expect(world.getWall(0, 16)).toBe(WallId.Dirt);
  });
});
