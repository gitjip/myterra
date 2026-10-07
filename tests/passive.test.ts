import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { TileId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { Passive, PassiveKind, PassiveManager } from '../src/entity/passive';
import { World } from '../src/world/world';

function arena(surface: TileId): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 60; x++) world.setTile(x, 10, surface);
  return world;
}

describe('passive rabbit', () => {
  it('flees away from a nearby player', () => {
    const world = arena(TileId.Grass);
    const rabbit = new Passive(PassiveKind.Rabbit, 10, 10 - 0.5);
    for (let i = 0; i < 60; i++) rabbit.update(world, 12, 1 / 60);
    expect(rabbit.centreX).toBeLessThan(10);
  });

  it('is startled and flees when hit, dropping loot on death', () => {
    const rabbit = new Passive(PassiveKind.Rabbit, 10, 10 - 0.5);
    expect(rabbit.hit(1, 1)).toBe(false);
    expect(rabbit.fleeTimer).toBeGreaterThan(0);
    expect(rabbit.alive).toBe(true);

    expect(rabbit.hit(100, 1)).toBe(true);
    expect(rabbit.alive).toBe(false);
  });

  it('spawns rabbits on lit grass', () => {
    const world = arena(TileId.Grass);
    const manager = new PassiveManager(new Rng(5));
    for (let i = 0; i < 20; i++) manager.update(world, 30, 9, 1, 1);
    expect(manager.rabbits.length).toBeGreaterThan(0);
  });
});
