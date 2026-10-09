import { approach } from '../core/math';
import { ENEMIES } from '../data/enemies';
import type { EnemyDefinition, EnemyKind } from '../data/enemies';
import { COMBAT, PLAYER } from '../data/tuning';
import type { Body } from '../systems/physics';
import { moveBody } from '../systems/physics';
import type { World } from '../world/world';

export interface EnemyShot {
  readonly vx: number;
  readonly vy: number;
  readonly damage: number;
}

/** A hostile creature. Behaviour is a small switch on its definition. */
export class Enemy {
  public readonly def: EnemyDefinition;
  public readonly body: Body;
  public hp: number;
  public facing: 1 | -1 = -1;
  public hitCooldown = 0;
  public flash = 0;
  public alive = true;
  private hopTimer = 0.4;
  private shotTimer = 0;
  private pendingShot: EnemyShot | null = null;

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

    let gravity = true;
    switch (this.def.behavior) {
      case 'walker':
        this.walkerAI(world, targetX, targetY, dt);
        break;
      case 'hopper':
        this.hopperAI(targetX, dt);
        break;
      case 'archer':
        this.archerAI(world, targetX, targetY, dt);
        break;
      case 'climber':
        gravity = this.climberAI(world, targetX, targetY, dt);
        break;
    }

    if (gravity) {
      this.body.vy = Math.min(this.body.vy + PLAYER.gravity * dt, PLAYER.maxFallSpeed);
    }
    moveBody(world, this.body, dt);
  }

  /** Returns and clears a queued ranged shot, if any. */
  public consumeShot(): EnemyShot | null {
    const shot = this.pendingShot;
    this.pendingShot = null;
    return shot;
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

  private walkerAI(world: World, targetX: number, targetY: number, dt: number): void {
    const dir = Math.sign(targetX - this.centreX) || 1;
    this.facing = dir >= 0 ? 1 : -1;
    this.body.vx = approach(this.body.vx, dir * this.def.speed, PLAYER.accelGround * dt);
    if (!this.body.onGround) return;
    if (this.blockedAhead(world, dir) || targetY < this.body.y - 1.5) {
      this.body.vy = -this.def.jumpVelocity;
    }
  }

  private archerAI(world: World, targetX: number, targetY: number, dt: number): void {
    const dx = targetX - this.centreX;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || 1;
    this.facing = dir >= 0 ? 1 : -1;

    if (dist < this.def.retreatRange) {
      this.body.vx = approach(this.body.vx, -dir * this.def.speed, PLAYER.accelGround * dt);
    } else if (dist > this.def.rangedRange) {
      this.body.vx = approach(this.body.vx, dir * this.def.speed, PLAYER.accelGround * dt);
      if (this.body.onGround && this.blockedAhead(world, dir)) {
        this.body.vy = -this.def.jumpVelocity;
      }
    } else {
      this.body.vx = approach(this.body.vx, 0, PLAYER.frictionGround * dt);
      this.shotTimer -= dt;
      if (this.shotTimer <= 0) {
        this.shotTimer = this.def.rangedCooldown;
        const vy = Math.max(-6, Math.min(2, (targetY - this.centreY) * 0.5));
        this.pendingShot = {
          vx: dir * this.def.projectileSpeed,
          vy,
          damage: this.def.rangedDamage,
        };
      }
    }
  }

  private hopperAI(targetX: number, dt: number): void {
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

  /** Spiders cling to walls and ceilings. Returns false while clinging. */
  private climberAI(world: World, targetX: number, targetY: number, dt: number): boolean {
    const x = Math.floor(this.body.x);
    const y = Math.floor(this.body.y);
    const right = Math.floor(this.body.x + this.body.w);
    const cy = Math.floor(this.centreY);
    const leftWall = world.isSolid(x - 1, cy);
    const rightWall = world.isSolid(right, cy);
    const ceiling = world.isSolid(x, y - 1);
    const clinging = this.body.onGround || leftWall || rightWall || ceiling;

    const dir = Math.sign(targetX - this.centreX) || 1;
    this.facing = dir >= 0 ? 1 : -1;

    if (!clinging) {
      this.body.vx = approach(this.body.vx, dir * this.def.speed, PLAYER.accelGround * dt);
      return true;
    }

    const dy = targetY - this.centreY;
    if ((leftWall || rightWall) && Math.abs(dy) > 1.2) {
      this.body.vx = approach(this.body.vx, 0, PLAYER.accelGround * dt);
      this.body.vy = approach(
        this.body.vy,
        Math.sign(dy) * this.def.speed * 0.7,
        PLAYER.accelGround * dt,
      );
    } else {
      this.body.vx = approach(this.body.vx, dir * this.def.speed, PLAYER.accelGround * dt);
      this.body.vy = approach(this.body.vy, 0, PLAYER.accelGround * dt);
      if (this.body.onGround && this.blockedAhead(world, dir)) {
        this.body.vy = -this.def.speed;
      }
    }
    return false;
  }

  private blockedAhead(world: World, dir: number): boolean {
    const aheadX =
      dir > 0 ? Math.floor(this.body.x + this.body.w + 0.1) : Math.floor(this.body.x - 0.1);
    const feetY = Math.floor(this.body.y + this.body.h - 0.1);
    return world.isSolid(aheadX, feetY);
  }
}
