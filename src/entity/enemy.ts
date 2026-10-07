import { approach } from '../core/math';
import { EnemyKind, ENEMIES } from '../data/enemies';
import type { EnemyDefinition } from '../data/enemies';
import { COMBAT, PLAYER } from '../data/tuning';
import type { Body } from '../systems/physics';
import { moveBody } from '../systems/physics';
import type { World } from '../world/world';

/** A hostile creature. Behaviour is a small switch on its kind. */
export class Enemy {
  public readonly def: EnemyDefinition;
  public readonly body: Body;
  public hp: number;
  public facing: 1 | -1 = -1;
  public hitCooldown = 0;
  public flash = 0;
  public alive = true;
  private hopTimer = 0.4;

  public constructor(
    public readonly kind: EnemyKind,
    x: number,
    y: number,
  ) {
    this.def = ENEMIES[kind];
    this.hp = this.def.hp;
    this.body = {
      x,
      y,
      vx: 0,
      vy: 0,
      w: this.def.width,
      h: this.def.height,
      onGround: false,
    };
  }

  public get centreX(): number {
    return this.body.x + this.body.w / 2;
  }

  public get centreY(): number {
    return this.body.y + this.body.h / 2;
  }

  public update(world: World, targetX: number, targetY: number, dt: number): void {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.kind === EnemyKind.Zombie) {
      this.zombieAI(world, targetX, targetY, dt);
    } else {
      this.slimeAI(targetX, dt);
    }
    this.body.vy = Math.min(this.body.vy + PLAYER.gravity * dt, PLAYER.maxFallSpeed);
    moveBody(world, this.body, dt);
  }

  /** Applies damage. Returns true when this hit killed the enemy. */
  public hit(damage: number, dirX: number): boolean {
    if (!this.alive || this.hitCooldown > 0) return false;
    this.hp -= damage;
    this.hitCooldown = COMBAT.hitInvulnerability;
    this.flash = 0.15;
    this.body.vx = dirX * COMBAT.knockback;
    this.body.vy = -6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  private zombieAI(world: World, targetX: number, targetY: number, dt: number): void {
    const dir = Math.sign(targetX - this.centreX) || 1;
    this.facing = dir >= 0 ? 1 : -1;
    this.body.vx = approach(this.body.vx, dir * this.def.speed, PLAYER.accelGround * dt);
    if (!this.body.onGround) return;

    const aheadX =
      dir > 0 ? Math.floor(this.body.x + this.body.w + 0.1) : Math.floor(this.body.x - 0.1);
    const feetY = Math.floor(this.body.y + this.body.h - 0.1);
    const blocked = world.isSolid(aheadX, feetY);
    const playerAbove = targetY < this.body.y - 1.5;
    if (blocked || playerAbove) this.body.vy = -this.def.jumpVelocity;
  }

  private slimeAI(targetX: number, dt: number): void {
    this.facing = targetX >= this.centreX ? 1 : -1;
    if (!this.body.onGround) return;
    this.hopTimer -= dt;
    if (this.hopTimer <= 0) {
      this.hopTimer = 0.8;
      this.body.vy = -this.def.jumpVelocity;
      this.body.vx = (Math.sign(targetX - this.centreX) || 1) * this.def.speed;
    } else {
      this.body.vx = approach(this.body.vx, 0, PLAYER.frictionGround * dt);
    }
  }
}
