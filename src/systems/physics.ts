import { WORLD } from '../data/tuning';
import { LiquidType } from '../world/world';
import type { World } from '../world/world';

/**
 * Axis-separated AABB versus tile-grid collision. Pure and DOM-free so the
 * player can be simulated headless in tests.
 *
 * Coordinates are tiles, y grows downward. A body's `(x, y)` is its top-left
 * corner. Every per-step displacement stays well under one tile at the tuned
 * speeds, so resolving only the leading edge is sufficient and cheap.
 */

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
}

const EPSILON = 1e-6;

export interface MoveResult {
  /** Horizontal velocity was zeroed by a wall. */
  readonly hitX: boolean;
  /** Vertical velocity was zeroed by a floor or ceiling. */
  readonly hitY: boolean;
  /** The body landed on something during this step. */
  readonly landed: boolean;
}

/** Integrates velocity and resolves collisions, axis by axis (X then Y). */
export function moveBody(world: World, body: Body, dt: number): MoveResult {
  let hitX = false;
  let hitY = false;
  let landed = false;

  body.x += body.vx * dt;
  if (body.vx !== 0 && resolveHorizontal(world, body, body.vx > 0 ? 1 : -1)) {
    body.vx = 0;
    hitX = true;
  }

  body.onGround = false;
  body.y += body.vy * dt;
  if (body.vy !== 0 && resolveVertical(world, body, body.vy > 0 ? 1 : -1)) {
    if (body.vy > 0) {
      body.onGround = true;
      landed = true;
    }
    body.vy = 0;
    hitY = true;
  }

  clampToReach(world, body);
  return { hitX, hitY, landed };
}

function resolveHorizontal(world: World, body: Body, direction: 1 | -1): boolean {
  const top = Math.floor(body.y + EPSILON);
  const bottom = Math.floor(body.y + body.h - EPSILON);
  if (direction > 0) {
    const tileX = Math.floor(body.x + body.w - EPSILON);
    for (let y = top; y <= bottom; y++) {
      if (world.isSolid(tileX, y)) {
        body.x = tileX - body.w;
        return true;
      }
    }
  } else {
    const tileX = Math.floor(body.x + EPSILON);
    for (let y = top; y <= bottom; y++) {
      if (world.isSolid(tileX, y)) {
        body.x = tileX + 1;
        return true;
      }
    }
  }
  return false;
}

function resolveVertical(world: World, body: Body, direction: 1 | -1): boolean {
  const left = Math.floor(body.x + EPSILON);
  const right = Math.floor(body.x + body.w - EPSILON);
  if (direction > 0) {
    const tileY = Math.floor(body.y + body.h - EPSILON);
    for (let x = left; x <= right; x++) {
      if (world.isSolid(x, tileY)) {
        body.y = tileY - body.h;
        return true;
      }
    }
  } else {
    const tileY = Math.floor(body.y + EPSILON);
    for (let x = left; x <= right; x++) {
      if (world.isSolid(x, tileY)) {
        body.y = tileY + 1;
        return true;
      }
    }
  }
  return false;
}

/** Keeps the body inside the reachable area, excluding the buffer and bedrock. */
function clampToReach(world: World, body: Body): void {
  const maxX = world.reachWidth - body.w;
  if (body.x < 0) {
    body.x = 0;
    body.vx = 0;
  } else if (body.x > maxX) {
    body.x = maxX;
    body.vx = 0;
  }

  const minY = WORLD.yReachMin;
  const maxY = WORLD.yReachMax + 1 - body.h;
  if (body.y < minY) {
    body.y = minY;
    body.vy = Math.max(body.vy, 0);
  } else if (body.y > maxY) {
    body.y = maxY;
    body.vy = Math.min(body.vy, 0);
    body.onGround = true;
  }
}

function tileHasLiquid(world: World, tx: number, ty: number): boolean {
  const cell = world.liquidAt(tx, ty);
  return cell.amount > 0 && cell.type !== LiquidType.None;
}

/** True when any tile the body overlaps holds liquid. */
export function bodyInLiquid(world: World, body: Body): boolean {
  const left = Math.floor(body.x + EPSILON);
  const right = Math.floor(body.x + body.w - EPSILON);
  const top = Math.floor(body.y + EPSILON);
  const bottom = Math.floor(body.y + body.h - EPSILON);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (tileHasLiquid(world, x, y)) return true;
    }
  }
  return false;
}

/** True when the tile at the top of the body (the head) holds liquid. */
export function headInLiquid(world: World, body: Body): boolean {
  const x = Math.floor(body.x + body.w / 2);
  const y = Math.floor(body.y + 0.4);
  return tileHasLiquid(world, x, y);
}

/** Liquid type at the centre of the body, or None. */
export function liquidAtBodyCentre(world: World, body: Body): LiquidType {
  const cell = world.liquidAt(Math.floor(body.x + body.w / 2), Math.floor(body.y + body.h / 2));
  return cell.amount > 0 ? cell.type : LiquidType.None;
}
