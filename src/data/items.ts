import { TileId, type ToolClass } from './tiles';

/** Item ids for the M3 first batch. Later milestones append here. */
export enum ItemId {
  Dirt = 0,
  Stone = 1,
  Wood = 2,
  Leaf = 3,
  Sand = 4,
  Torch = 5,
  Door = 6,
  WoodPickaxe = 7,
  WoodAxe = 8,
  WoodHammer = 9,
  WoodShovel = 10,
}

export interface Footprint {
  readonly w: number;
  readonly h: number;
}

export interface ItemDefinition {
  readonly name: string;
  readonly stackMax: number;
  /** Tile placed by this item, or null for tools / special placement. */
  readonly tile: TileId | null;
  readonly tool: ToolClass | null;
  /** 0 = none, 1 = wood. Higher tiers arrive with content expansion. */
  readonly tier: number;
  readonly footprint: Footprint;
  /** Torches must touch a solid tile or a background wall. */
  readonly requiresSupport: boolean;
  readonly isDoor: boolean;
}

const UNIT: Footprint = { w: 1, h: 1 };

function block(
  name: string,
  tileId: TileId,
  options: Partial<ItemDefinition> = {},
): ItemDefinition {
  return {
    name,
    stackMax: 999,
    tile: tileId,
    tool: null,
    tier: 0,
    footprint: UNIT,
    requiresSupport: false,
    isDoor: false,
    ...options,
  };
}

function tool(name: string, toolClass: ToolClass): ItemDefinition {
  return {
    name,
    stackMax: 1,
    tile: null,
    tool: toolClass,
    tier: 1,
    footprint: UNIT,
    requiresSupport: false,
    isDoor: false,
  };
}

export const ITEM_DEFINITIONS: Readonly<Record<ItemId, ItemDefinition>> = {
  [ItemId.Dirt]: block('Dirt', TileId.Dirt),
  [ItemId.Stone]: block('Stone', TileId.Stone),
  [ItemId.Wood]: block('Wood', TileId.Wood),
  [ItemId.Leaf]: block('Leaves', TileId.Leaf),
  [ItemId.Sand]: block('Sand', TileId.Sand),
  [ItemId.Torch]: block('Torch', TileId.Torch, { requiresSupport: true }),
  [ItemId.Door]: block('Door', TileId.DoorBottomOpen, { isDoor: true, footprint: { w: 1, h: 2 } }),
  [ItemId.WoodPickaxe]: tool('Wood Pickaxe', 'pickaxe'),
  [ItemId.WoodAxe]: tool('Wood Axe', 'axe'),
  [ItemId.WoodHammer]: tool('Wood Hammer', 'hammer'),
  [ItemId.WoodShovel]: tool('Wood Shovel', 'shovel'),
};

export function itemDefinition(item: ItemId): ItemDefinition {
  return ITEM_DEFINITIONS[item];
}

export function tileForItem(item: ItemId): TileId | null {
  return ITEM_DEFINITIONS[item].tile;
}

export function toolClassOf(item: ItemId): ToolClass | null {
  return ITEM_DEFINITIONS[item].tool;
}

/** Item produced by mining a tile, or null when it drops nothing. */
export function dropForTile(tileId: TileId): ItemId | null {
  switch (tileId) {
    case TileId.Dirt:
      return ItemId.Dirt;
    case TileId.Grass:
      return ItemId.Dirt;
    case TileId.Stone:
      return ItemId.Stone;
    case TileId.Wood:
      return ItemId.Wood;
    case TileId.Leaf:
      return ItemId.Leaf;
    case TileId.Sand:
      return ItemId.Sand;
    case TileId.Torch:
      return ItemId.Torch;
    case TileId.DoorTopClosed:
    case TileId.DoorTopOpen:
    case TileId.DoorBottomClosed:
    case TileId.DoorBottomOpen:
      return ItemId.Door;
    default:
      return null;
  }
}

/** Inverse lookup used by the hotbar and, later, the creative panel. */
export function itemForTile(tileId: TileId): ItemId | null {
  return dropForTile(tileId);
}
