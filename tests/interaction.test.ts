import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { TileId, WallId } from '../src/data/tiles';
import { MINING, PLAYER, WORLD } from '../src/data/tuning';
import { Inventory } from '../src/systems/inventory';
import {
  applyPlacement,
  breakTile,
  canPlace,
  InteractionSystem,
  mineSeconds,
  miningProfile,
  withinReach,
} from '../src/systems/interaction';
import type { Body } from '../src/systems/physics';
import { World } from '../src/world/world';

function makeWorld(): World {
  return new World({ reachWidth: WORLD.minReachWidth });
}

function bodyAt(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, w: PLAYER.width, h: PLAYER.height, onGround: false };
}

const standing = (): Body => bodyAt(10, -PLAYER.height);

describe('mining rules', () => {
  it('requires a tool for stone and allows bare-handed dirt', () => {
    expect(miningProfile(TileId.Stone, null).minable).toBe(false);
    expect(miningProfile(TileId.Dirt, null).minable).toBe(true);
    expect(miningProfile(TileId.Dirt, null).drops).toBe(true);
  });

  it('penalises the wrong tool and suppresses its drop', () => {
    const axe = miningProfile(TileId.Stone, 'axe');
    expect(axe.minable).toBe(true);
    expect(axe.multiplier).toBe(4);
    expect(axe.drops).toBe(false);

    const pick = miningProfile(TileId.Stone, 'pickaxe');
    expect(pick.multiplier).toBe(1);
    expect(pick.drops).toBe(true);
  });

  it('never allows unbreakable tiles', () => {
    expect(miningProfile(TileId.Bedrock, 'pickaxe').minable).toBe(false);
    expect(mineSeconds(TileId.Bedrock, 'pickaxe')).toBe(Number.POSITIVE_INFINITY);
  });

  it('scales duration with hardness and floors zero-hardness tiles', () => {
    expect(mineSeconds(TileId.Stone, 'pickaxe')).toBeCloseTo(3 * MINING.secondsPerHardness, 5);
    expect(mineSeconds(TileId.Torch, null)).toBeGreaterThanOrEqual(MINING.minSeconds);
  });
});

describe('placement rules', () => {
  it('places into empty air within reach', () => {
    const world = makeWorld();
    expect(canPlace(world, standing(), ItemId.Stone, 12, -2).ok).toBe(true);
  });

  it('rejects occupied tiles and out-of-reach targets', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    expect(canPlace(world, standing(), ItemId.Stone, 12, -2).reason).toBe('occupied');
    expect(canPlace(world, standing(), ItemId.Stone, 40, -2).reason).toBe('out of reach');
  });

  it('refuses to bury the player', () => {
    const world = makeWorld();
    const overlapping = bodyAt(10, -0.9);
    expect(overlapping.w).toBeLessThan(1);
    expect(canPlace(world, overlapping, ItemId.Stone, 10, 0).reason).toBe('blocked by player');
  });

  it('requires a support for torches', () => {
    const world = makeWorld();
    expect(canPlace(world, standing(), ItemId.Torch, 12, -2).reason).toBe('needs support');
    world.setWall(12, -2, WallId.Dirt);
    expect(canPlace(world, standing(), ItemId.Torch, 12, -2).ok).toBe(true);
  });

  it('places doors only into two empty tiles', () => {
    const world = makeWorld();
    expect(canPlace(world, standing(), ItemId.Door, 12, -2).ok).toBe(true);
    world.setTile(12, -3, TileId.Stone);
    expect(canPlace(world, standing(), ItemId.Door, 12, -2).reason).toBe(
      'door needs two empty tiles',
    );
  });
});

describe('breakTile', () => {
  it('clears a tile and reports its drop', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const event = breakTile(world, 12, -2, true);
    expect(event).toEqual({ x: 12, y: -2, tile: TileId.Stone, drop: ItemId.Stone });
    expect(world.getTile(12, -2)).toBe(TileId.Air);
  });

  it('suppresses the drop for the wrong tool path', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const event = breakTile(world, 12, -2, false);
    expect(event?.drop).toBeNull();
  });

  it('removes both halves of a door and drops one door item', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 12, -2);
    expect(world.getTile(12, -3)).toBe(TileId.DoorTopOpen);
    const event = breakTile(world, 12, -3, true);
    expect(event?.drop).toBe(ItemId.Door);
    expect(world.getTile(12, -3)).toBe(TileId.Air);
    expect(world.getTile(12, -2)).toBe(TileId.Air);
  });

  it('ignores bedrock and air', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Bedrock);
    expect(breakTile(world, 12, -2, true)).toBeNull();
    expect(breakTile(world, 13, -2, true)).toBeNull();
  });
});

describe('withinReach', () => {
  it('uses the rectangular expansion', () => {
    const body = standing();
    expect(withinReach(body, 15, 4)).toBe(true);
    expect(withinReach(body, 16, 0)).toBe(false);
  });
});

describe('InteractionSystem', () => {
  it('finishes mining stone with a pickaxe', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const inventory = new Inventory();
    inventory.addItem(ItemId.WoodPickaxe);
    const system = new InteractionSystem();

    let event = null;
    for (let i = 0; i < 300 && !event; i++) {
      event = system.update(world, standing(), inventory, {
        tileX: 12,
        tileY: -2,
        hasTarget: true,
        mine: true,
        placePressed: false,
        placeHeld: false,
        dt: 1 / 60,
      });
    }
    expect(event?.tile).toBe(TileId.Stone);
    expect(event?.drop).toBe(ItemId.Stone);
    expect(world.getTile(12, -2)).toBe(TileId.Air);
    expect(system.mining).toBe(false);
  });

  it('cannot mine stone bare-handed', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const inventory = new Inventory();
    const system = new InteractionSystem();
    for (let i = 0; i < 300; i++) {
      system.update(world, standing(), inventory, {
        tileX: 12,
        tileY: -2,
        hasTarget: true,
        mine: true,
        placePressed: false,
        placeHeld: false,
        dt: 1 / 60,
      });
    }
    expect(world.getTile(12, -2)).toBe(TileId.Stone);
  });

  it('breaks with the wrong tool but drops nothing', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const inventory = new Inventory();
    inventory.addItem(ItemId.WoodAxe);
    const system = new InteractionSystem();

    let event = null;
    for (let i = 0; i < 800 && !event; i++) {
      event = system.update(world, standing(), inventory, {
        tileX: 12,
        tileY: -2,
        hasTarget: true,
        mine: true,
        placePressed: false,
        placeHeld: false,
        dt: 1 / 60,
      });
    }
    expect(event?.tile).toBe(TileId.Stone);
    expect(event?.drop).toBeNull();
  });

  it('places and consumes the selected item', () => {
    const world = makeWorld();
    world.setTile(12, -1, TileId.Stone);
    const inventory = new Inventory();
    inventory.addItem(ItemId.Torch, 3);
    const system = new InteractionSystem();

    system.update(world, standing(), inventory, {
      tileX: 12,
      tileY: -2,
      hasTarget: true,
      mine: false,
      placePressed: true,
      placeHeld: false,
      dt: 1 / 60,
    });
    expect(world.getTile(12, -2)).toBe(TileId.Torch);
    expect(inventory.countOf(ItemId.Torch)).toBe(2);
  });

  it('toggles an existing door on right click', () => {
    const world = makeWorld();
    applyPlacement(world, ItemId.Door, 12, -2);
    const inventory = new Inventory();
    const system = new InteractionSystem();

    system.update(world, standing(), inventory, {
      tileX: 12,
      tileY: -2,
      hasTarget: true,
      mine: false,
      placePressed: true,
      placeHeld: false,
      dt: 1 / 60,
    });
    expect(world.getTile(12, -2)).toBe(TileId.DoorBottomClosed);
    expect(world.getTile(12, -3)).toBe(TileId.DoorTopClosed);
  });
});

describe('creative sandbox', () => {
  const base = {
    tileX: 12,
    tileY: -2,
    hasTarget: true,
    mine: false,
    placePressed: false,
    placeHeld: false,
    dt: 1 / 60,
  } as const;

  it('breaks instantly with no tool when instantMine is set', () => {
    const world = makeWorld();
    world.setTile(12, -2, TileId.Stone);
    const system = new InteractionSystem();
    const event = system.update(world, standing(), new Inventory(), {
      ...base,
      mine: true,
      instantMine: true,
    });
    expect(event?.tile).toBe(TileId.Stone);
    expect(world.getTile(12, -2)).toBe(TileId.Air);
  });

  it('does not consume the held item with infinitePlace', () => {
    const world = makeWorld();
    world.setTile(12, -1, TileId.Stone);
    const inventory = new Inventory();
    inventory.addItem(ItemId.Torch, 3);
    const system = new InteractionSystem();
    system.update(world, standing(), inventory, {
      ...base,
      placePressed: true,
      infinitePlace: true,
    });
    expect(world.getTile(12, -2)).toBe(TileId.Torch);
    expect(inventory.countOf(ItemId.Torch)).toBe(3);
  });

  it('places raw palette tiles with no inventory', () => {
    const world = makeWorld();
    const system = new InteractionSystem();
    system.update(world, standing(), new Inventory(), {
      ...base,
      placePressed: true,
      paletteTile: TileId.Stone,
    });
    expect(world.getTile(12, -2)).toBe(TileId.Stone);
  });

  it('places a palette door as both open halves', () => {
    const world = makeWorld();
    const system = new InteractionSystem();
    system.update(world, standing(), new Inventory(), {
      ...base,
      placePressed: true,
      paletteTile: TileId.DoorBottomOpen,
    });
    expect(world.getTile(12, -2)).toBe(TileId.DoorBottomOpen);
    expect(world.getTile(12, -3)).toBe(TileId.DoorTopOpen);
  });
});
