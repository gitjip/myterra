import { describe, expect, it } from 'vitest';
import { PLAYER, SURVIVAL, TEST_WORLD, WORLD } from '../src/data/tuning';
import { NEUTRAL_INPUT, Player } from '../src/entity/player';
import type { PlayerInput } from '../src/entity/player';
import type { World } from '../src/world/world';
import { createTestWorld, testSpawnPoint } from '../src/world/testWorld';

const DT = 1 / 60;

function simulate(player: Player, world: World, seconds: number, input: PlayerInput): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) player.update(world, input, DT);
}

function dryPlayer(): { player: Player; world: World } {
  const world = createTestWorld(WORLD.minReachWidth);
  const spawn = testSpawnPoint(world.reachWidth);
  const player = new Player(spawn.x - PLAYER.width / 2, spawn.y - PLAYER.height);
  return { player, world };
}

/** A player dropped straight into the test pool, feet-first. */
function wetPlayer(): { player: Player; world: World } {
  const world = createTestWorld(WORLD.minReachWidth);
  const centre = Math.floor(world.reachWidth / 2) + TEST_WORLD.poolXOffset;
  const player = new Player(centre - PLAYER.width / 2, TEST_WORLD.surfaceY - 3);
  return { player, world };
}

describe('player', () => {
  it('settles on the ground after spawning', () => {
    const { player, world } = dryPlayer();
    simulate(player, world, 2, NEUTRAL_INPUT);
    expect(player.body.onGround).toBe(true);
    expect(player.dead).toBe(false);
  });

  it('drains hunger at the documented rate', () => {
    const { player, world } = dryPlayer();
    simulate(player, world, 60, NEUTRAL_INPUT);
    expect(player.hunger).toBeCloseTo(SURVIVAL.maxHunger - SURVIVAL.hungerDrainPerSecond * 60, 3);
  });

  it('refills breath on land', () => {
    const { player, world } = dryPlayer();
    player.breath = 0;
    simulate(player, world, 3, NEUTRAL_INPUT);
    expect(player.breath).toBe(SURVIVAL.maxBreath);
  });

  it('drowns after fifteen seconds underwater', () => {
    const { player, world } = wetPlayer();
    simulate(player, world, 25, NEUTRAL_INPUT);
    expect(player.headInWater).toBe(true);
    expect(player.breath).toBe(0);
    expect(player.health).toBeLessThan(SURVIVAL.maxHealth);
  });

  it('starves to death when hunger hits zero', () => {
    const { player, world } = dryPlayer();
    player.hunger = 0;
    simulate(player, world, 10, NEUTRAL_INPUT);
    expect(player.health).toBeCloseTo(SURVIVAL.maxHealth - SURVIVAL.starveDamagePerSecond * 10, 3);
  });

  it('regenerates health while well fed', () => {
    const { player, world } = dryPlayer();
    player.health = 50;
    player.hunger = SURVIVAL.maxHunger;
    simulate(player, world, 10, NEUTRAL_INPUT);
    expect(player.health).toBeCloseTo(50 + SURVIVAL.regenPerSecond * 10, 3);
  });

  it('eats raw meat to restore health and hunger', () => {
    const { player } = dryPlayer();
    player.health = 50;
    player.hunger = 50;
    player.eatRaw();
    expect(player.health).toBe(50 + SURVIVAL.rawMeatHeal);
    expect(player.hunger).toBe(50 + SURVIVAL.rawMeatHunger);
  });

  it('marks the player dead when health runs out', () => {
    const { player, world } = dryPlayer();
    player.health = 1;
    player.hunger = 0;
    simulate(player, world, 1, NEUTRAL_INPUT);
    expect(player.dead).toBe(true);
    expect(player.health).toBe(0);
  });

  it('flies without gravity when creative flight is enabled', () => {
    const { player, world } = dryPlayer();
    player.canFly = true;
    const startY = player.body.y;
    simulate(player, world, 1, { moveX: 1, moveY: -1, jump: false });
    expect(player.body.vy).toBeCloseTo(-PLAYER.flySpeedVertical, 3);
    expect(player.body.vx).toBeCloseTo(PLAYER.flySpeedHorizontal, 3);
    expect(player.body.y).toBeLessThan(startY - 10);
    expect(player.body.onGround).toBe(false);
  });

  it('respawns with full stats at the given point', () => {
    const { player } = dryPlayer();
    player.health = 0;
    player.hunger = 3;
    player.breath = 7;
    player.dead = true;
    player.respawn(12, 4);
    expect(player.dead).toBe(false);
    expect(player.health).toBe(SURVIVAL.maxHealth);
    expect(player.hunger).toBe(SURVIVAL.maxHunger);
    expect(player.breath).toBe(SURVIVAL.maxBreath);
    expect(player.body.x).toBe(12);
    expect(player.body.y).toBe(4);
  });
});
