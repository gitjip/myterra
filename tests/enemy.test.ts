import { describe, expect, it } from 'vitest';
import { EnemyKind } from '../src/data/enemies';
import { TileId } from '../src/data/tiles';
import { WORLD } from '../src/data/tuning';
import { Enemy } from '../src/entity/enemy';
import type { EnemyShot } from '../src/entity/enemy';
import { World } from '../src/world/world';

function arena(): World {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 80; x++) world.setTile(x, 10, TileId.Stone);
  return world;
}

describe('enemy behaviour', () => {
  it('makes a zombie walk toward the player', () => {
    const world = arena();
    const zombie = new Enemy(EnemyKind.Zombie, 5, 10 - 1.8);
    for (let i = 0; i < 120; i++) zombie.update(world, 40, 9, 1 / 60);
    expect(zombie.centreX).toBeGreaterThan(5);
    expect(zombie.body.onGround).toBe(true);
  });

  it('makes a slime hop', () => {
    const world = arena();
    const slime = new Enemy(EnemyKind.Slime, 5, 10 - 0.7);
    let hopped = false;
    for (let i = 0; i < 120; i++) {
      slime.update(world, 40, 9, 1 / 60);
      if (slime.body.vy < 0) hopped = true;
    }
    expect(hopped).toBe(true);
  });

  it('makes a zombie jump at a wall', () => {
    const world = arena();
    for (let y = 5; y < 10; y++) world.setTile(7, y, TileId.Stone);
    const zombie = new Enemy(EnemyKind.Zombie, 5, 10 - 1.8);
    let jumped = false;
    for (let i = 0; i < 180; i++) {
      zombie.update(world, 20, 9, 1 / 60);
      if (zombie.body.vy < 0) jumped = true;
    }
    expect(jumped).toBe(true);
  });

  it('skeleton fires a bone when the player is in range', () => {
    const world = arena();
    const skeleton = new Enemy(EnemyKind.Skeleton, 5, 10 - 1.8);
    let shot: EnemyShot | null = null;
    for (let i = 0; i < 180 && shot === null; i++) {
      skeleton.update(world, 14, 9, 1 / 60);
      shot = skeleton.consumeShot();
    }
    expect(shot).not.toBeNull();
    expect(shot?.vx).toBeGreaterThan(0);
    expect(shot?.damage).toBeGreaterThan(0);
  });

  it('spider clings to a wall and climbs toward the player', () => {
    const world = arena();
    for (let y = 4; y < 10; y++) world.setTile(8, y, TileId.Stone);
    const spider = new Enemy(EnemyKind.Spider, 9.1, 8);
    let climbed = false;
    for (let i = 0; i < 120; i++) {
      spider.update(world, 9, 0, 1 / 60);
      if (spider.body.vy < -0.5) climbed = true;
    }
    expect(climbed).toBe(true);
  });
});
