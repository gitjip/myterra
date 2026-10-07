import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { TileId } from '../src/data/tiles';
import { PLAYER, WORLD } from '../src/data/tuning';
import { doorBlocked, doorStateAt, setDoorOpen, toggleDoor } from '../src/entity/door';
import { applyPlacement } from '../src/systems/interaction';
import type { Body } from '../src/systems/physics';
import { World } from '../src/world/world';

function makeWorld(): World {
  return new World({ reachWidth: WORLD.minReachWidth });
}

function bodyAt(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, w: PLAYER.width, h: PLAYER.height, onGround: false };
}

describe('door', () => {
  it('resolves the same state from either half', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 5, 0);

    const bottom = doorStateAt(world, 5, 0);
    const top = doorStateAt(world, 5, -1);
    expect(bottom).toEqual({ x: 5, topY: -1, bottomY: 0, open: true });
    expect(top).toEqual(bottom);
  });

  it('returns null for non-door tiles', () => {
    const world = makeWorld();
    world.setTile(3, 0, TileId.Stone);
    expect(doorStateAt(world, 3, 0)).toBeNull();
  });

  it('opens and closes both halves together', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 5, 0);
    const state = doorStateAt(world, 5, 0);
    if (!state) throw new Error('expected a door');
    setDoorOpen(world, state, false);
    expect(world.getTile(5, -1)).toBe(TileId.DoorTopClosed);
    expect(world.getTile(5, 0)).toBe(TileId.DoorBottomClosed);
    setDoorOpen(world, state, true);
    expect(world.getTile(5, -1)).toBe(TileId.DoorTopOpen);
    expect(world.getTile(5, 0)).toBe(TileId.DoorBottomOpen);
  });

  it('refuses to close on a blocking body', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 5, 0);
    const blocker = bodyAt(5, -1);
    const state = doorStateAt(world, 5, 0);
    if (!state) throw new Error('expected a door');

    expect(doorBlocked(state, [blocker])).toBe(true);
    expect(toggleDoor(world, 5, 0, [blocker])).toBe(false);
    expect(world.getTile(5, 0)).toBe(TileId.DoorBottomOpen);
  });

  it('toggles freely when nothing blocks it', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 5, 0);
    expect(toggleDoor(world, 5, 0, [])).toBe(true);
    expect(world.getTile(5, 0)).toBe(TileId.DoorBottomClosed);
    expect(toggleDoor(world, 5, 0, [])).toBe(true);
    expect(world.getTile(5, 0)).toBe(TileId.DoorBottomOpen);
    expect(toggleDoor(world, 99, 0, [])).toBe(false);
  });
});
