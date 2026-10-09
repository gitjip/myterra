import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { TileId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { Player } from '../src/entity/player';
import { Passive, PassiveKind } from '../src/entity/passive';
import { bucketUse } from '../src/systems/interaction';
import { LiquidType, World } from '../src/world/world';

function flat(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x < 60; x++) world.setTile(x, 10, TileId.Stone);
  return world;
}

describe('armor', () => {
  it('reduces incoming damage and never below 1', () => {
    const player = new Player(0, 0);
    player.armorReduction = 40;
    player.hurt(8, 0, 0);
    expect(player.health).toBe(100 - 5); // round(8 * 0.6) = 5

    const naked = new Player(0, 0);
    naked.hurt(8, 0, 0);
    expect(naked.health).toBe(92);
  });
});

describe('buckets', () => {
  it('fills an empty bucket from liquid', () => {
    const world = flat();
    world.setLiquid(5, 8, LiquidType.Water, 80);
    const result = bucketUse(world, ItemId.EmptyBucket, 5, 8);
    expect(result.ok).toBe(true);
    expect(result.item).toBe(ItemId.WaterBucket);
    expect(world.liquidAt(5, 8).amount).toBe(0);
  });

  it('takes lava into a lava bucket', () => {
    const world = flat();
    world.setLiquid(6, 8, LiquidType.Lava, 100);
    expect(bucketUse(world, ItemId.EmptyBucket, 6, 8).item).toBe(ItemId.LavaBucket);
  });

  it('pours a bucket into air', () => {
    const world = flat();
    const result = bucketUse(world, ItemId.WaterBucket, 7, 7);
    expect(result.ok).toBe(true);
    expect(result.item).toBe(ItemId.EmptyBucket);
    expect(world.liquidAt(7, 7)).toEqual({ type: LiquidType.Water, amount: 100 });
  });

  it('refuses to pour into a solid or occupied cell', () => {
    const world = flat();
    expect(bucketUse(world, ItemId.WaterBucket, 3, 10).ok).toBe(false);
    world.setLiquid(4, 7, LiquidType.Water, 40);
    expect(bucketUse(world, ItemId.WaterBucket, 4, 7).ok).toBe(false);
  });
});

describe('flying passives', () => {
  it('keeps a bird aloft (no gravity)', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    const bird = new Passive(PassiveKind.Bird, 5, 5);
    const startY = bird.body.y;
    for (let i = 0; i < 120; i++) bird.update(world, 999, 1 / 60);
    expect(Math.abs(bird.body.y - startY)).toBeLessThan(1);
  });
});
