import { ItemId } from './items';

export enum EnemyKind {
  Zombie = 'zombie',
  Slime = 'slime',
}

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
  readonly drops: readonly EnemyDrop[];
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
    drops: [
      { item: ItemId.Gel, chance: 0.5, min: 1, max: 2 },
      { item: ItemId.RawMeat, chance: 0.3, min: 1, max: 1 },
    ],
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
    drops: [{ item: ItemId.Gel, chance: 1, min: 1, max: 2 }],
  },
};
