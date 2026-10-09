/**
 * Ability flags. A mode is just a preset of these; switching modes swaps the
 * whole flag set without rebuilding the world. Placement, the hotbar and the
 * number keys behave identically in both modes.
 */
export interface AbilityFlags {
  canFly: boolean;
  invulnerable: boolean;
  instantMine: boolean;
  infinitePlace: boolean;
  skipCrafting: boolean;
  enemiesHostile: boolean;
  infiniteItems: boolean;
  hasHunger: boolean;
  hasBreath: boolean;
  takeDamage: boolean;
}

export type ModeName = 'survival' | 'creative';

export const SURVIVAL: AbilityFlags = {
  canFly: false,
  invulnerable: false,
  instantMine: false,
  infinitePlace: false,
  skipCrafting: false,
  enemiesHostile: true,
  infiniteItems: false,
  hasHunger: true,
  hasBreath: true,
  takeDamage: true,
};

export const CREATIVE: AbilityFlags = {
  canFly: true,
  invulnerable: true,
  instantMine: true,
  infinitePlace: true,
  skipCrafting: true,
  enemiesHostile: false,
  infiniteItems: true,
  hasHunger: false,
  hasBreath: false,
  takeDamage: false,
};

export const MODE: Readonly<Record<ModeName, AbilityFlags>> = {
  survival: SURVIVAL,
  creative: CREATIVE,
};

/** Mutable holder. `set` replaces the flag set reference, never mutates it. */
export class Mode {
  private nameValue: ModeName;
  private flagsValue: AbilityFlags;

  public constructor(name: ModeName = 'survival') {
    this.nameValue = name;
    this.flagsValue = MODE[name];
  }

  public get name(): ModeName {
    return this.nameValue;
  }

  public get flags(): AbilityFlags {
    return this.flagsValue;
  }

  public set(name: ModeName): void {
    this.nameValue = name;
    this.flagsValue = MODE[name];
  }

  public toggle(): ModeName {
    this.set(this.nameValue === 'survival' ? 'creative' : 'survival');
    return this.nameValue;
  }
}
