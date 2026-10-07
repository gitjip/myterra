import { rectsOverlap } from '../core/math';
import { COMBAT } from '../data/tuning';
import type { Body } from './physics';

export interface CombatRegion {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Melee swing cooldown plus the forward hit region. */
export class CombatSystem {
  private cooldown = 0;

  public get ready(): boolean {
    return this.cooldown <= 0;
  }

  public update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /** Starts a swing if the cooldown allows. */
  public trySwing(): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = COMBAT.meleeCooldown;
    return true;
  }

  /** Reach rectangle in front of the body; a 90-degree arc approximation. */
  public region(body: Body, facing: 1 | -1): CombatRegion {
    const reach = 1.7;
    return {
      x: facing > 0 ? body.x + body.w : body.x - reach,
      y: body.y - 0.2,
      w: reach,
      h: body.h + 0.4,
    };
  }

  public static overlaps(region: CombatRegion, body: Body): boolean {
    return rectsOverlap(region, body);
  }
}
