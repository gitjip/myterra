import { ItemId } from './items';

export enum EnemyKind {
  Zombie = 'zombie',
  Slime = 'slime',
  Skeleton = 'skeleton',
  Spider = 'spider',
}

export type EnemyBehavior = 'walker' | 'hopper' | 'archer' | 'climber';

export interface EnemyDrop {
  readonly item: ItemId;
  readonly chance: number;
  readonly min: number;
  readonly max: number;
}

export interface EnemyDefinition {
  readonly name: string;
  readonly hp: number;
  readonly contactDamage: number;
  /** Horizontal walk speed, tiles/s. */
  readonly speed: number;
  readonly jumpVelocity: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly behavior: EnemyBehavior;
  readonly drops: readonly EnemyDrop[];
  /** Archer only: ranged attack parameters (0 for melee). */
  readonly rangedDamage: number;
  readonly rangedCooldown: number;
  readonly rangedRange: number;
  readonly retreatRange: number;
  readonly projectileSpeed: number;
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyDefinition>> = {
  [EnemyKind.Zombie]: {
    name: 'Zombie',
    hp: 40,
    contactDamage: 8,
    speed: 4,
    jumpVelocity: 14,
    width: 0.8,
    height: 1.8,
    color: '#5a7d4a',
    behavior: 'walker',
    drops: [
      { item: ItemId.Gel, chance: 0.5, min: 1, max: 2 },
      { item: ItemId.RawMeat, chance: 0.3, min: 1, max: 1 },
    ],
    rangedDamage: 0,
    rangedCooldown: 0,
    rangedRange: 0,
    retreatRange: 0,
    projectileSpeed: 0,
  },
  [EnemyKind.Slime]: {
    name: 'Slime',
    hp: 15,
    contactDamage: 6,
    speed: 3,
    jumpVelocity: 10,
    width: 0.9,
    height: 0.7,
    color: '#4a86c8',
    behavior: 'hopper',
    drops: [{ item: ItemId.Gel, chance: 1, min: 1, max: 2 }],
    rangedDamage: 0,
    rangedCooldown: 0,
    rangedRange: 0,
    retreatRange: 0,
    projectileSpeed: 0,
  },
  [EnemyKind.Skeleton]: {
    name: 'Skeleton',
    hp: 60,
    contactDamage: 10,
    speed: 5,
    jumpVelocity: 14,
    width: 0.8,
    height: 1.8,
    color: '#d8d8cc',
    behavior: 'archer',
    drops: [{ item: ItemId.Bone, chance: 1, min: 1, max: 2 }],
    rangedDamage: 10,
    rangedCooldown: 2,
    rangedRange: 12,
    retreatRange: 3,
    projectileSpeed: 20,
  },
  [EnemyKind.Spider]: {
    name: 'Spider',
    hp: 35,
    contactDamage: 12,
    speed: 9,
    jumpVelocity: 10,
    width: 0.8,
    height: 0.6,
    color: '#3a3a44',
    behavior: 'climber',
    drops: [{ item: ItemId.Silk, chance: 1, min: 1, max: 2 }],
    rangedDamage: 0,
    rangedCooldown: 0,
    rangedRange: 0,
    retreatRange: 0,
    projectileSpeed: 0,
  },
};
