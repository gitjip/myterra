import { describe, expect, it } from 'vitest';
import { PLAYER, PLAYER_JUMP_VELOCITY, WORLD } from '../src/data/tuning';
import { TileId } from '../src/data/tiles';
import type { Body } from '../src/systems/physics';
import { bodyInLiquid, headInLiquid, moveBody } from '../src/systems/physics';
import { LiquidType, World } from '../src/world/world';

const DT = 1 / 60;
const EPS = 1e-6;

function makeWorld(): World {
  return new World({ reachWidth: WORLD.minReachWidth });
}

function fill(world: World, x0: number, x1: number, y0: number, y1: number, tile: TileId): void {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) world.setTile(x, y, tile);
  }
}

function makeBody(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, w: PLAYER.width, h: PLAYER.height, onGround: false };
}

describe('physics', () => {
  it('falls and lands on a floor without tunnelling', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    const body = makeBody(4, 0);

    for (let i = 0; i < 180; i++) {
      body.vy = Math.min(body.vy + PLAYER.gravity * DT, PLAYER.maxFallSpeed);
      moveBody(world, body, DT);
    }

    expect(body.onGround).toBe(true);
    expect(body.y + body.h).toBeCloseTo(20, 5);
  });

  it('stops at a wall instead of tunnelling through it', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    fill(world, 10, 10, 0, 19, TileId.Stone);
    const body = makeBody(2, 20 - PLAYER.height);

    for (let i = 0; i < 120; i++) {
      body.vx = PLAYER.moveSpeed;
      body.vy = Math.min(body.vy + PLAYER.gravity * DT, PLAYER.maxFallSpeed);
      moveBody(world, body, DT);
    }

    expect(body.x + body.w).toBeLessThanOrEqual(10 + EPS);
    expect(body.x + body.w).toBeCloseTo(10, 5);
  });

  it('reaches the documented jump height', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    const body = makeBody(4, 20 - PLAYER.height);
    body.onGround = true;
    body.vy = -PLAYER_JUMP_VELOCITY;

    let minY = body.y;
    for (let i = 0; i < 200; i++) {
      body.vy = Math.min(body.vy + PLAYER.gravity * DT, PLAYER.maxFallSpeed);
      moveBody(world, body, DT);
      minY = Math.min(minY, body.y);
    }

    const height = 20 - PLAYER.height - minY;
    expect(height).toBeGreaterThanOrEqual(5.5);
    expect(height).toBeLessThanOrEqual(6.5);
  });

  it('stops at a ceiling', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    fill(world, 0, 63, 14, 14, TileId.Stone);
    const body = makeBody(4, 20 - PLAYER.height);
    body.onGround = true;
    body.vy = -PLAYER_JUMP_VELOCITY;

    let minY = body.y;
    for (let i = 0; i < 120; i++) {
      body.vy = Math.min(body.vy + PLAYER.gravity * DT, PLAYER.maxFallSpeed);
      moveBody(world, body, DT);
      minY = Math.min(minY, body.y);
    }

    expect(minY).toBeGreaterThanOrEqual(15 - EPS);
  });

  it('passes through a one-tile doorway without sticking', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    fill(world, 10, 10, 0, 17, TileId.Stone);
    const body = makeBody(5, 20 - PLAYER.height);

    for (let i = 0; i < 180; i++) {
      body.vx = PLAYER.moveSpeed;
      body.vy = Math.min(body.vy + PLAYER.gravity * DT, PLAYER.maxFallSpeed);
      moveBody(world, body, DT);
    }

    expect(body.x).toBeGreaterThan(11);
  });

  it('sinks in water and caps the fall speed', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    for (let y = 0; y < 20; y++) {
      for (let x = 4; x <= 6; x++) world.setLiquid(x, y, LiquidType.Water, 100);
    }
    const body = makeBody(4, 0);
    let sawWater = false;

    for (let i = 0; i < 300; i++) {
      const inWater = bodyInLiquid(world, body);
      const gravity = PLAYER.gravity * (inWater ? PLAYER.waterGravityFactor : 1);
      const maxFall = inWater ? PLAYER.waterMaxFallSpeed : PLAYER.maxFallSpeed;
      body.vy = Math.min(body.vy + gravity * DT, maxFall);
      moveBody(world, body, DT);
      if (inWater) {
        sawWater = true;
        expect(body.vy).toBeLessThanOrEqual(PLAYER.waterMaxFallSpeed + EPS);
      }
    }

    expect(sawWater).toBe(true);
    expect(bodyInLiquid(world, body)).toBe(true);
  });

  it('reports the head as submerged separately from the body', () => {
    const world = makeWorld();
    fill(world, 0, 63, 20, 20, TileId.Stone);
    for (let y = 16; y < 20; y++) {
      for (let x = 4; x <= 6; x++) world.setLiquid(x, y, LiquidType.Water, 100);
    }
    const body = makeBody(5, 20 - PLAYER.height);

    expect(bodyInLiquid(world, body)).toBe(true);
    expect(headInLiquid(world, body)).toBe(true);
  });
});
