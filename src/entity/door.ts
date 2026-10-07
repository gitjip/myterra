import { rectsOverlap } from '../core/math';
import { isDoorTile, TileId } from '../data/tiles';
import type { World } from '../world/world';
import type { Body } from '../systems/physics';

/**
 * Doors are two foreground tiles, not entities. This module owns the mapping
 * between the four door tile ids and the open/closed, top/bottom state.
 */

export interface DoorState {
  readonly x: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly open: boolean;
}

/** Resolves the door containing tile (x, y), or null when it is not a door. */
export function doorStateAt(world: World, x: number, y: number): DoorState | null {
  const tile = world.getTile(x, y);
  if (!isDoorTile(tile)) return null;
  const isTop = tile === TileId.DoorTopClosed || tile === TileId.DoorTopOpen;
  const open = tile === TileId.DoorTopOpen || tile === TileId.DoorBottomOpen;
  return {
    x,
    topY: isTop ? y : y - 1,
    bottomY: isTop ? y + 1 : y,
    open,
  };
}

export function setDoorOpen(world: World, state: DoorState, open: boolean): void {
  world.setTile(state.x, state.topY, open ? TileId.DoorTopOpen : TileId.DoorTopClosed);
  world.setTile(state.x, state.bottomY, open ? TileId.DoorBottomOpen : TileId.DoorBottomClosed);
}

/** True when a body blocks the door from closing. Opening is never blocked. */
export function doorBlocked(state: DoorState, blockers: readonly Body[]): boolean {
  const door = { x: state.x, y: state.topY, w: 1, h: 2 };
  return blockers.some((body) => rectsOverlap(body, door));
}

/** Toggles the door at (x, y). Returns false when there is nothing to toggle. */
export function toggleDoor(
  world: World,
  x: number,
  y: number,
  blockers: readonly Body[] = [],
): boolean {
  const state = doorStateAt(world, x, y);
  if (!state) return false;
  if (state.open) {
    if (doorBlocked(state, blockers)) return false;
    setDoorOpen(world, state, false);
  } else {
    setDoorOpen(world, state, true);
  }
  return true;
}
