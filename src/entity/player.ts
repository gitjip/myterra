import { approach, clamp } from '../core/math';
import { LIQUID, PLAYER, PLAYER_JUMP_VELOCITY, SURVIVAL } from '../data/tuning';
import type { Body } from '../systems/physics';
import { bodyInLiquid, headInLiquid, moveBody } from '../systems/physics';
import type { World } from '../world/world';

/** Abstracted player intent for one fixed step; produced by the input manager. */
export interface PlayerInput {
  /** -1 left, 0 none, 1 right. */
  readonly moveX: -1 | 0 | 1;
  /** -1 up, 0 none, 1 down. Used for swimming and creative flight. */
  readonly moveY: -1 | 0 | 1;
  readonly jump: boolean;
}

export const NEUTRAL_INPUT: PlayerInput = { moveX: 0, moveY: 0, jump: false };

export interface PlayerOptions {
  /** Creative flight. Reserved here; M4 wires it to the mode flags. */
  readonly canFly?: boolean;
}

/**
 * The single player entity. Owns the collision body plus the survival stats.
 *
 * Physical and DOM-free on purpose: the whole update is a pure step over
 * (world, input, dt), so tests can drive it headless.
 */
export class Player {
  public readonly body: Body;
  public health: number = SURVIVAL.maxHealth;
  public hunger: number = SURVIVAL.maxHunger;
  public breath: number = SURVIVAL.maxBreath;
  public facing: 1 | -1 = 1;
  public dead = false;
  public inWater = false;
  public headInWater = false;
  public canFly: boolean;

  private jumpHeld = false;

  public constructor(x: number, y: number, options: PlayerOptions = {}) {
    this.body = {
      x,
      y,
      vx: 0,
      vy: 0,
      w: PLAYER.width,
      h: PLAYER.height,
      onGround: false,
    };
    this.canFly = options.canFly ?? false;
  }

  /** Centre of the collision box, in tiles. */
  public get centreX(): number {
    return this.body.x + this.body.w / 2;
  }

  public get centreY(): number {
    return this.body.y + this.body.h / 2;
  }

  public update(world: World, input: PlayerInput, dt: number): void {
    this.inWater = bodyInLiquid(world, this.body);
    this.applyMovement(this.dead ? NEUTRAL_INPUT : input, dt);
    moveBody(world, this.body, dt);
    if (!this.dead) this.updateSurvival(world, dt);
  }

  /** Debug / future item use: raw meat heals and restores a little hunger. */
  public eatRaw(): void {
    if (this.dead) return;
    this.health = Math.min(SURVIVAL.maxHealth, this.health + SURVIVAL.rawMeatHeal);
    this.hunger = Math.min(SURVIVAL.maxHunger, this.hunger + SURVIVAL.rawMeatHunger);
  }

  private applyMovement(input: PlayerInput, dt: number): void {
    if (this.canFly) {
      this.body.vx = approach(
        this.body.vx,
        input.moveX * PLAYER.flySpeedHorizontal,
        PLAYER.accelGround * dt,
      );
      this.body.vy = approach(
        this.body.vy,
        input.moveY * PLAYER.flySpeedVertical,
        PLAYER.accelGround * dt,
      );
      if (input.moveX !== 0) this.facing = input.moveX > 0 ? 1 : -1;
      return;
    }

    if (input.moveX !== 0) {
      const waterFactor = this.inWater ? LIQUID.waterSpeedFactor : 1;
      const target = input.moveX * PLAYER.moveSpeed * waterFactor;
      const accel = this.body.onGround ? PLAYER.accelGround : PLAYER.accelAir;
      this.body.vx = approach(this.body.vx, target, accel * dt);
      this.facing = input.moveX > 0 ? 1 : -1;
    } else {
      const friction = (this.body.onGround ? PLAYER.frictionGround : PLAYER.frictionAir) * dt;
      this.body.vx = approach(this.body.vx, 0, friction);
    }

    if (this.inWater) {
      if (input.jump || input.moveY < 0) {
        this.body.vy = -PLAYER.waterUpSpeed;
      } else {
        this.body.vy = Math.min(
          this.body.vy + PLAYER.gravity * PLAYER.waterGravityFactor * dt,
          PLAYER.waterMaxFallSpeed,
        );
      }
    } else {
      this.body.vy = Math.min(this.body.vy + PLAYER.gravity * dt, PLAYER.maxFallSpeed);
      if (input.jump && !this.jumpHeld && this.body.onGround) {
        this.body.vy = -PLAYER_JUMP_VELOCITY;
      }
    }

    this.jumpHeld = input.jump;
  }

  private updateSurvival(world: World, dt: number): void {
    this.headInWater = headInLiquid(world, this.body);

    if (this.headInWater) {
      this.breath = Math.max(0, this.breath - SURVIVAL.breathDrainPerSecond * dt);
    } else {
      this.breath = Math.min(SURVIVAL.maxBreath, this.breath + SURVIVAL.breathRegenPerSecond * dt);
    }

    this.hunger = Math.max(0, this.hunger - SURVIVAL.hungerDrainPerSecond * dt);

    if (this.hunger > SURVIVAL.regenHungerThreshold && this.health < SURVIVAL.maxHealth) {
      this.health = Math.min(SURVIVAL.maxHealth, this.health + SURVIVAL.regenPerSecond * dt);
    }
    if (this.hunger <= 0) {
      this.health -= SURVIVAL.starveDamagePerSecond * dt;
    }
    if (this.headInWater && this.breath <= 0) {
      this.health -= SURVIVAL.drownDamagePerSecond * dt;
    }

    this.health = clamp(this.health, 0, SURVIVAL.maxHealth);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
}
