import { describe, expect, it } from 'vitest';
import { TileId } from '../src/data/tiles';
import { COMBAT, WORLD } from '../src/data/tuning';
import { ProjectileManager } from '../src/entity/projectile';
import { World } from '../src/world/world';

function flat(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x < 60; x++) world.setTile(x, 10, TileId.Stone);
  return world;
}

describe('projectiles', () => {
  it('despawns when it hits a tile', () => {
    const world = flat();
    const projectiles = new ProjectileManager();
    projectiles.spawn('player', 10, 5, 5, 6, 0);
    for (let i = 0; i < 200; i++) projectiles.update(world, 1 / 60);
    expect(projectiles.count).toBe(0);
  });

  it('expires after its lifetime', () => {
    const world = new World({ reachWidth: WORLD.minReachWidth });
    const projectiles = new ProjectileManager();
    projectiles.spawn('player', 10, 5, 0, 0, 0);
    const ticks = Math.ceil(COMBAT.projectileLifetime * 60) + 10;
    for (let i = 0; i < ticks; i++) projectiles.update(world, 1 / 60);
    expect(projectiles.count).toBe(0);
  });

  it('respects the global cap', () => {
    const projectiles = new ProjectileManager();
    for (let i = 0; i < COMBAT.projectileLimit + 50; i++) {
      projectiles.spawn('player', 10, 5, 5, 0, 0);
    }
    expect(projectiles.count).toBe(COMBAT.projectileLimit);
  });
});
