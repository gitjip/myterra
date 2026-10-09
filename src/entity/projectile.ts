import { COMBAT } from '../data/tuning';
import type { Body } from '../systems/physics';
import { moveBody } from '../systems/physics';
import type { World } from '../world/world';

export type ProjectileOwner = 'player' | 'enemy';

/** A single arrow. Owners are only used to avoid self-hits, not for teams. */
export class Projectile {
  public readonly body: Body;
  public life = COMBAT.projectileLifetime;
  public alive = true;

  public constructor(
    public readonly owner: ProjectileOwner,
    public readonly damage: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ) {
    this.body = { x, y, vx, vy, w: 0.3, h: 0.3, onGround: false };
  }

  public get centreX(): number {
    return this.body.x + this.body.w / 2;
  }

  public get centreY(): number {
    return this.body.y + this.body.h / 2;
  }
}

/** Owns all in-flight arrows: physics, tile collisions and the global cap. */
export class ProjectileManager {
  private readonly list: Projectile[] = [];

  public get count(): number {
    return this.list.length;
  }

  public get all(): readonly Projectile[] {
    return this.list;
  }

  public spawn(
    owner: ProjectileOwner,
    damage: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): void {
    if (this.list.length >= COMBAT.projectileLimit) return;
    this.list.push(new Projectile(owner, damage, x, y, vx, vy));
  }

  public update(world: World, dt: number): void {
    let write = 0;
    for (const projectile of this.list) {
      projectile.life -= dt;
      projectile.body.vy += COMBAT.arrowGravity * dt;
      const result = moveBody(world, projectile.body, dt);
      const embedded = world.isSolid(
        Math.floor(projectile.centreX),
        Math.floor(projectile.centreY),
      );
      if (result.hitX || result.hitY || embedded || projectile.life <= 0) {
        projectile.alive = false;
      }
      if (projectile.alive) this.list[write++] = projectile;
    }
    this.list.length = write;
  }

  public remove(projectile: Projectile): void {
    const index = this.list.indexOf(projectile);
    if (index >= 0) {
      this.list[index] = this.list[this.list.length - 1] as Projectile;
      this.list.pop();
    }
  }

  public clear(): void {
    this.list.length = 0;
  }
}
