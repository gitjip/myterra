import { chebyshev } from '../core/math';
import type { Rng } from '../core/rng';
import { ENEMIES, EnemyKind } from '../data/enemies';
import { ENTITY, LIGHT } from '../data/tuning';
import { Enemy } from '../entity/enemy';
import type { World } from '../world/world';

/** Combined light at a cell, matching the renderer's brightness rule. */
export function lightAt(world: World, x: number, y: number, dayFactor: number): number {
  const idx = world.idx(x, y);
  const sky = (255 - (world.skyDepth[idx] ?? 255)) * dayFactor;
  const block = world.blockLight[idx] ?? 0;
  return sky > block ? sky : block;
}

/**
 * A valid spawn cell has solid ground at (x, y), two air rows above, no liquid,
 * sits inside the reachable range and is dark enough.
 */
export function canSpawnAt(world: World, x: number, y: number, dayFactor: number): boolean {
  if (!world.inReach(x, y)) return false;
  if (!world.isSolid(x, y)) return false;
  for (const ay of [y - 1, y - 2]) {
    if (world.isSolid(x, ay)) return false;
    if (world.liquidAt(x, ay).amount > 0) return false;
  }
  return lightAt(world, x, y - 1, dayFactor) < LIGHT.spawnLightThreshold;
}

/** Nearest valid ground row around `nearY`, or null. */
export function findSpawnSpot(
  world: World,
  x: number,
  nearY: number,
  dayFactor: number,
): number | null {
  for (let offset = 0; offset <= 24; offset++) {
    for (const y of [nearY - offset, nearY + offset]) {
      if (canSpawnAt(world, x, y, dayFactor)) return y;
    }
  }
  return null;
}

/** Spawns and despawns enemies around the player. */
export class SpawnSystem {
  private timer = ENTITY.spawnIntervalSeconds;
  /** Runtime overrides, driven by the simulation-distance setting. */
  public simulateRadius: number = ENTITY.simulateRadius;
  public despawnRadius: number = ENTITY.despawnRadius;

  public constructor(private readonly rng: Rng) {}

  public update(
    world: World,
    playerX: number,
    playerY: number,
    dayFactor: number,
    enemies: Enemy[],
    dt: number,
  ): void {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (!enemy) continue;
      if (chebyshev(enemy.centreX, enemy.centreY, playerX, playerY) > this.despawnRadius) {
        enemies.splice(i, 1);
      }
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = ENTITY.spawnIntervalSeconds;
    if (enemies.length >= ENTITY.maxEnemies) return;

    for (let attempt = 0; attempt < ENTITY.spawnAttempts; attempt++) {
      const x =
        Math.round(playerX) + this.rng.nextIntRange(-this.simulateRadius, this.simulateRadius + 1);
      const spot = findSpawnSpot(world, x, Math.round(playerY), dayFactor);
      if (spot === null) continue;
      const kind = this.rng.chance(0.5) ? EnemyKind.Zombie : EnemyKind.Slime;
      enemies.push(new Enemy(kind, x, spot - ENEMIES[kind].height));
      break;
    }
  }
}
