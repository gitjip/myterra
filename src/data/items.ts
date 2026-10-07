import { TileId, type ToolClass } from './tiles';

/** Item ids. Never renumber existing values; saves store raw ids. */
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
  Coal = 11,
  IronOre = 12,
  GoldOre = 13,
  IronIngot = 14,
  GoldIngot = 15,
  StonePickaxe = 16,
  StoneAxe = 17,
  StoneHammer = 18,
  StoneShovel = 19,
  IronPickaxe = 20,
  IronAxe = 21,
  IronHammer = 22,
  IronShovel = 23,
  WoodSword = 24,
  StoneSword = 25,
  IronSword = 26,
  RawMeat = 27,
  CookedMeat = 28,
  Workbench = 29,
  Furnace = 30,
  Chest = 31,
  Gel = 32,
  Bone = 33,
  Silk = 34,
  Leather = 35,
  Rope = 36,
}

export type StationType = 'workbench' | 'furnace' | 'chest';

export interface Footprint {
  readonly w: number;
  readonly h: number;
}

export interface FoodValue {
  readonly heal: number;
  readonly hunger: number;
}

export interface ItemDefinition {
  readonly name: string;
  readonly stackMax: number;
  /** Tile placed by this item, or null for tools / special placement. */
  readonly tile: TileId | null;
  readonly tool: ToolClass | null;
  /** 0 = none, 1 = wood, 2 = stone, 3 = iron. */
  readonly tier: number;
  readonly footprint: Footprint;
  /** Torches must touch a solid tile or a background wall. */
  readonly requiresSupport: boolean;
  readonly isDoor: boolean;
  readonly station: StationType | null;
  /** Seconds of furnace burn provided when used as fuel. */
  readonly fuelValue: number;
  readonly food: FoodValue | null;
  /** Melee damage; 0 for non-weapons. */
  readonly weaponDamage: number;
}

const UNIT: Footprint = { w: 1, h: 1 };
const BASE: Omit<ItemDefinition, 'name' | 'stackMax' | 'tile'> = {
  tool: null,
  tier: 0,
  footprint: UNIT,
  requiresSupport: false,
  isDoor: false,
  station: null,
  fuelValue: 0,
  food: null,
  weaponDamage: 0,
};

function block(
  name: string,
  tileId: TileId,
  options: Partial<ItemDefinition> = {},
): ItemDefinition {
  return { ...BASE, name, stackMax: 999, tile: tileId, ...options };
}

function tool(name: string, toolClass: ToolClass, tier: number): ItemDefinition {
  return { ...BASE, name, stackMax: 1, tile: null, tool: toolClass, tier };
}

function item(name: string, options: Partial<ItemDefinition> = {}): ItemDefinition {
  return { ...BASE, name, stackMax: 999, tile: null, ...options };
}

export const ITEM_DEFINITIONS: Readonly<Record<ItemId, ItemDefinition>> = {
  [ItemId.Dirt]: block('Dirt', TileId.Dirt),
  [ItemId.Stone]: block('Stone', TileId.Stone),
  [ItemId.Wood]: block('Wood', TileId.Wood, { fuelValue: 10 }),
  [ItemId.Leaf]: block('Leaves', TileId.Leaf),
  [ItemId.Sand]: block('Sand', TileId.Sand),
  [ItemId.Torch]: block('Torch', TileId.Torch, { requiresSupport: true }),
  [ItemId.Door]: block('Door', TileId.DoorBottomOpen, { isDoor: true, footprint: { w: 1, h: 2 } }),

  [ItemId.WoodPickaxe]: tool('Wood Pickaxe', 'pickaxe', 1),
  [ItemId.WoodAxe]: tool('Wood Axe', 'axe', 1),
  [ItemId.WoodHammer]: tool('Wood Hammer', 'hammer', 1),
  [ItemId.WoodShovel]: tool('Wood Shovel', 'shovel', 1),
  [ItemId.StonePickaxe]: tool('Stone Pickaxe', 'pickaxe', 2),
  [ItemId.StoneAxe]: tool('Stone Axe', 'axe', 2),
  [ItemId.StoneHammer]: tool('Stone Hammer', 'hammer', 2),
  [ItemId.StoneShovel]: tool('Stone Shovel', 'shovel', 2),
  [ItemId.IronPickaxe]: tool('Iron Pickaxe', 'pickaxe', 3),
  [ItemId.IronAxe]: tool('Iron Axe', 'axe', 3),
  [ItemId.IronHammer]: tool('Iron Hammer', 'hammer', 3),
  [ItemId.IronShovel]: tool('Iron Shovel', 'shovel', 3),

  [ItemId.WoodSword]: item('Wood Sword', { stackMax: 1, tier: 1, weaponDamage: 6 }),
  [ItemId.StoneSword]: item('Stone Sword', { stackMax: 1, tier: 2, weaponDamage: 9 }),
  [ItemId.IronSword]: item('Iron Sword', { stackMax: 1, tier: 3, weaponDamage: 13 }),

  [ItemId.Coal]: item('Coal', { fuelValue: 30 }),
  [ItemId.IronOre]: item('Iron Ore'),
  [ItemId.GoldOre]: item('Gold Ore'),
  [ItemId.IronIngot]: item('Iron Ingot'),
  [ItemId.GoldIngot]: item('Gold Ingot'),
  [ItemId.Gel]: item('Gel'),
  [ItemId.Bone]: item('Bone'),
  [ItemId.Silk]: item('Silk'),
  [ItemId.Leather]: item('Leather'),
  [ItemId.Rope]: item('Rope'),

  [ItemId.RawMeat]: item('Raw Meat', { stackMax: 99, food: { heal: 20, hunger: 5 } }),
  [ItemId.CookedMeat]: item('Cooked Meat', { stackMax: 99, food: { heal: 40, hunger: 15 } }),

  [ItemId.Workbench]: block('Workbench', TileId.Workbench, {
    stackMax: 99,
    station: 'workbench',
    footprint: { w: 2, h: 1 },
  }),
  [ItemId.Furnace]: block('Furnace', TileId.Furnace, {
    stackMax: 99,
    station: 'furnace',
    footprint: { w: 2, h: 1 },
  }),
  [ItemId.Chest]: block('Chest', TileId.Chest, {
    stackMax: 99,
    station: 'chest',
    footprint: { w: 2, h: 1 },
  }),
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

export function toolTierOf(item: ItemId): number {
  return ITEM_DEFINITIONS[item].tier;
}

export function stationOfTile(tile: TileId): StationType | null {
  switch (tile) {
    case TileId.Workbench:
      return 'workbench';
    case TileId.Furnace:
      return 'furnace';
    case TileId.Chest:
      return 'chest';
    default:
      return null;
  }
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
    case TileId.CoalOre:
      return ItemId.Coal;
    case TileId.IronOre:
      return ItemId.IronOre;
    case TileId.GoldOre:
      return ItemId.GoldOre;
    case TileId.Workbench:
      return ItemId.Workbench;
    case TileId.Furnace:
      return ItemId.Furnace;
    case TileId.Chest:
      return ItemId.Chest;
    case TileId.DoorTopClosed:
    case TileId.DoorTopOpen:
    case TileId.DoorBottomClosed:
    case TileId.DoorBottomOpen:
      return ItemId.Door;
    default:
      return null;
  }
}

/** Inverse lookup used by the hotbar and the creative panel. */
export function itemForTile(tileId: TileId): ItemId | null {
  return dropForTile(tileId);
}
