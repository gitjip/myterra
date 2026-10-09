import { approach, chebyshev } from '../core/math';
import { Rng } from '../core/rng';
import { ItemId } from '../data/items';
import { TileId } from '../data/tiles';
import { ENTITY, PLAYER } from '../data/tuning';
import type { Body } from '../systems/physics';
import { moveBody } from '../systems/physics';
import type { World } from '../world/world';

export enum PassiveKind {
  Rabbit = 'rabbit',
  Bird = 'bird',
  Fish = 'fish',
}

export type PassiveMovement = 'ground' | 'flying' | 'aquatic';

export interface PassiveDrop {
  readonly item: ItemId;
  readonly chance: number;
  readonly min: number;
  readonly max: number;
}

export interface PassiveDefinition {
  readonly name: string;
  readonly hp: number;
  readonly width: number;
  readonly height: number;
  readonly wanderSpeed: number;
  readonly fleeSpeed: number;
  readonly color: string;
  readonly movement: PassiveMovement;
  readonly drops: readonly PassiveDrop[];
}

export const PASSIVES: Readonly<Record<PassiveKind, PassiveDefinition>> = {
  [PassiveKind.Rabbit]: {
    name: 'Rabbit',
    hp: 5,
    width: 0.6,
    height: 0.5,
    wanderSpeed: 1.5,
    fleeSpeed: 7,
    color: '#d8d2c4',
    movement: 'ground',
    drops: [
      { item: ItemId.RawMeat, chance: 0.5, min: 1, max: 1 },
      { item: ItemId.Leather, chance: 0.5, min: 1, max: 1 },
    ],
  },
  [PassiveKind.Bird]: {
    name: 'Bird',
    hp: 5,
    width: 0.5,
    height: 0.4,
    wanderSpeed: 2,
    fleeSpeed: 8,
    color: '#d9e2ea',
    movement: 'flying',
    drops: [],
  },
  [PassiveKind.Fish]: {
    name: 'Fish',
    hp: 5,
    width: 0.6,
    height: 0.35,
    wanderSpeed: 1.8,
    fleeSpeed: 5,
    color: '#4a90c8',
    movement: 'aquatic',
    drops: [],
  },
};

/** A harmless creature: wanders until startled, then flees. */
export class Passive {
  public readonly body: Body;
  public readonly def: PassiveDefinition;
  public hp: number;
  public alive = true;
  public facing: 1 | -1 = 1;
  public fleeTimer = 0;
  private wanderTimer = 0;
  private wanderDir = 1;

  public constructor(
    public readonly kind: PassiveKind,
    x: number,
    y: number,
    private readonly rng: Rng = new Rng(0),
  ) {
    this.def = PASSIVES[kind];
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

  public update(world: World, playerX: number, dt: number): void {
    this.fleeTimer = Math.max(0, this.fleeTimer - dt);
    if (this.def.movement === 'ground') this.groundAI(world, playerX, dt);
    else this.freeAI(playerX, dt);
  }

  /** Applies damage. Returns true when killed. A creature that survives flees. */
  public hit(damage: number, dirX: number): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.fleeTimer = 6;
    this.body.vx = dirX * this.def.fleeSpeed;
    this.body.vy = -4;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  private groundAI(world: World, playerX: number, dt: number): void {
    const near = Math.abs(playerX - this.centreX) < 7;
    if (this.fleeTimer > 0 || near) {
      const dir = Math.sign(this.centreX - playerX) || 1;
      this.facing = dir >= 0 ? 1 : -1;
      this.body.vx = approach(this.body.vx, dir * this.def.fleeSpeed, PLAYER.accelGround * dt);
    } else {
      this.wander(dt);
    }
    this.body.vy = Math.min(this.body.vy + PLAYER.gravity * dt, PLAYER.maxFallSpeed);
    moveBody(world, this.body, dt);
  }

  /** Birds and fish ignore gravity and drift; they flee away from the player. */
  private freeAI(playerX: number, dt: number): void {
    const near = Math.abs(playerX - this.centreX) < 6;
    if (this.fleeTimer > 0 || near) {
      const dir = Math.sign(this.centreX - playerX) || 1;
      this.facing = dir >= 0 ? 1 : -1;
      this.body.vx = approach(this.body.vx, dir * this.def.fleeSpeed, PLAYER.accelGround * dt);
      if (this.def.movement === 'flying') {
        this.body.vy = approach(this.body.vy, -this.def.fleeSpeed * 0.5, PLAYER.accelGround * dt);
      } else {
        this.body.vy = approach(this.body.vy, 0, PLAYER.accelGround * dt);
      }
    } else {
      this.wander(dt);
      this.body.vy = approach(this.body.vy, 0, PLAYER.accelGround * dt);
    }
  }

  private wander(dt: number): void {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = this.rng.nextRange(1, 3);
      this.wanderDir = this.rng.chance(0.5) ? -1 : 1;
    }
    this.body.vx = approach(
      this.body.vx,
      this.wanderDir * this.def.wanderSpeed,
      PLAYER.accelGround * dt,
    );
  }
}

/** Spawns, moves and despawns passive creatures around the player. */
export class PassiveManager {
  public readonly rabbits: Passive[] = [];
  /** Runtime overrides, driven by the simulation-distance setting. */
  public simulateRadius: number = ENTITY.simulateRadius;
  public despawnRadius: number = ENTITY.despawnRadius;
  private timer = 6;

  public constructor(private readonly rng: Rng) {}

  public update(
    world: World,
    playerX: number,
    playerY: number,
    dayFactor: number,
    dt: number,
  ): void {
    for (let i = this.rabbits.length - 1; i >= 0; i--) {
      const passive = this.rabbits[i];
      if (!passive) continue;
      if (
        !passive.alive ||
        chebyshev(passive.centreX, passive.centreY, playerX, playerY) > this.despawnRadius
      ) {
        this.rabbits.splice(i, 1);
        continue;
      }
      passive.update(world, playerX, dt);
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 8;
    if (this.rabbits.length >= 6) return;

    for (let attempt = 0; attempt < ENTITY.spawnAttempts; attempt++) {
      const x =
        Math.round(playerX) + this.rng.nextIntRange(-this.simulateRadius, this.simulateRadius + 1);
      const spot = this.findSpot(world, x, Math.round(playerY), dayFactor);
      if (spot === null) continue;
      this.rabbits.push(new Passive(spot.kind, x, spot.y, this.rng));
      break;
    }
  }

  private findSpot(
    world: World,
    x: number,
    nearY: number,
    dayFactor: number,
  ): { kind: PassiveKind; y: number } | null {
    const roll = this.rng.next();
    if (roll < 0.5) {
      const y = this.findGroundSpot(world, x, nearY, dayFactor);
      return y === null ? null : { kind: PassiveKind.Rabbit, y };
    }
    if (roll < 0.8) {
      const y = this.findSkySpot(world, x, nearY);
      return y === null ? null : { kind: PassiveKind.Bird, y };
    }
    const y = this.findWaterSpot(world, x, nearY);
    return y === null ? null : { kind: PassiveKind.Fish, y };
  }

  private findGroundSpot(world: World, x: number, nearY: number, dayFactor: number): number | null {
    for (let offset = 0; offset <= 20; offset++) {
      for (const y of [nearY - offset, nearY + offset]) {
        if (!world.inReach(x, y)) continue;
        if (world.getTile(x, y) !== TileId.Grass) continue;
        if (world.isSolid(x, y - 1) || world.isSolid(x, y - 2)) continue;
        const idx = world.idx(x, y - 1);
        const light = Math.max(
          (255 - (world.skyDepth[idx] ?? 255)) * dayFactor,
          world.blockLight[idx] ?? 0,
        );
        if (light < 60) continue;
        return y - PASSIVES[PassiveKind.Rabbit].height;
      }
    }
    return null;
  }

  private findSkySpot(world: World, x: number, nearY: number): number | null {
    for (let offset = 8; offset <= 40; offset++) {
      const y = nearY - offset;
      if (!world.inReach(x, y)) continue;
      if (world.isSolid(x, y) || world.isSolid(x, y + 1)) continue;
      return y;
    }
    return null;
  }

  private findWaterSpot(world: World, x: number, nearY: number): number | null {
    for (let offset = 0; offset <= 24; offset++) {
      for (const y of [nearY - offset, nearY + offset]) {
        if (!world.inReach(x, y)) continue;
        if (world.isSolid(x, y)) continue;
        if (world.liquidAt(x, y).amount > 0) return y;
      }
    }
    return null;
  }
}
