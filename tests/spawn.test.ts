import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { EnemyKind } from '../src/data/enemies';
import { TileId } from '../src/data/tiles';
import { ENTITY, WORLD } from '../src/data/tuning';
import { Enemy } from '../src/entity/enemy';
import { canSpawnAt, findSpawnSpot, SpawnSystem } from '../src/systems/spawn';
import { LiquidType, World } from '../src/world/world';

function arena(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 60; x++) {
    for (let y = 10; y <= 20; y++) world.setTile(x, y, TileId.Stone);
  }
  return world;
}

describe('spawn conditions', () => {
  it('requires solid ground, headroom, no liquid and darkness', () => {
    const world = arena();
    // Bright day: too light to spawn.
    expect(canSpawnAt(world, 10, 10, 1)).toBe(false);
    // Night: dark enough.
    expect(canSpawnAt(world, 10, 10, 0)).toBe(true);
  });

  it('rejects blocked headroom and liquid', () => {
    const world = arena();
    world.setTile(10, 9, TileId.Stone);
    expect(canSpawnAt(world, 11, 10, 0)).toBe(true);
    expect(canSpawnAt(world, 10, 10, 0)).toBe(false);

    world.setLiquid(12, 9, LiquidType.Water, 100);
    expect(canSpawnAt(world, 12, 10, 0)).toBe(false);
  });

  it('finds a spot near a column', () => {
    const world = arena();
    expect(findSpawnSpot(world, 20, 8, 0)).toBe(10);
  });
});

describe('spawn system', () => {
  it('caps the population and despawns strays', () => {
    const world = arena();
    const rng = new Rng(1);
    const spawn = new SpawnSystem(rng);
    const enemies: Enemy[] = [];
    const playerX = 30;
    const playerY = 10;

    for (let i = 0; i < 4000; i++) {
      spawn.update(world, playerX, playerY, 0, enemies, 1 / 60);
    }
    expect(enemies.length).toBeGreaterThan(0);
    expect(enemies.length).toBeLessThanOrEqual(ENTITY.maxEnemies);

    enemies.push(new Enemy(EnemyKind.Zombie, playerX + ENTITY.despawnRadius + 10, playerY));
    spawn.update(world, playerX, playerY, 0, enemies, 1 / 60);
    expect(enemies.every((e) => Math.abs(e.centreX - playerX) <= ENTITY.despawnRadius)).toBe(true);
  });
});
