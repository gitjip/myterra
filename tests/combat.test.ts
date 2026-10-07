import { describe, expect, it } from 'vitest';
import { EnemyKind } from '../src/data/enemies';
import { COMBAT } from '../src/data/tuning';
import { Enemy } from '../src/entity/enemy';
import { CombatSystem } from '../src/systems/combat';
import type { Body } from '../src/systems/physics';

function body(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, w: 0.8, h: 1.8, onGround: false };
}

describe('combat', () => {
  it('enforces the swing cooldown', () => {
    const combat = new CombatSystem();
    expect(combat.trySwing()).toBe(true);
    expect(combat.trySwing()).toBe(false);
    combat.update(COMBAT.meleeCooldown);
    expect(combat.trySwing()).toBe(true);
  });

  it('places the hit region in front of the player', () => {
    const combat = new CombatSystem();
    const player = body(10, 5);
    const right = combat.region(player, 1);
    const left = combat.region(player, -1);
    expect(right.x).toBeGreaterThanOrEqual(player.x + player.w);
    expect(left.x + left.w).toBeLessThanOrEqual(player.x);
  });

  it('damages, knocks back and kills an enemy', () => {
    const enemy = new Enemy(EnemyKind.Zombie, 0, 0);
    expect(enemy.hp).toBe(40);

    expect(enemy.hit(10, 1)).toBe(false);
    expect(enemy.hp).toBe(30);
    expect(enemy.body.vx).toBeGreaterThan(0);
    expect(enemy.hitCooldown).toBeCloseTo(COMBAT.hitInvulnerability, 5);

    // Still invulnerable: no further damage.
    enemy.hit(10, 1);
    expect(enemy.hp).toBe(30);

    enemy.hitCooldown = 0;
    expect(enemy.hit(100, -1)).toBe(true);
    expect(enemy.alive).toBe(false);
    expect(enemy.hp).toBe(0);
  });

  it('matches an enemy standing inside the swing region', () => {
    const combat = new CombatSystem();
    const player = body(10, 5);
    const region = combat.region(player, 1);
    const enemy = new Enemy(EnemyKind.Slime, 11.5, 5.2);
    expect(CombatSystem.overlaps(region, enemy.body)).toBe(true);
    const behind = new Enemy(EnemyKind.Slime, 7, 5.2);
    expect(CombatSystem.overlaps(region, behind.body)).toBe(false);
  });
});
