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
  Sandstone = 37,
  Cactus = 38,
  Snow = 39,
  Ice = 40,
  Mud = 41,
  Hardwood = 42,
  Vine = 43,
  Bow = 44,
  Arrow = 45,
  WoodHelmet = 46,
  WoodChestplate = 47,
  WoodLeggings = 48,
  IronHelmet = 49,
  IronChestplate = 50,
  IronLeggings = 51,
  GoldHelmet = 52,
  GoldChestplate = 53,
  GoldLeggings = 54,
  WaterBucket = 55,
  LavaBucket = 56,
  Obsidian = 57,
  Anvil = 58,
  Bed = 59,
  EmptyBucket = 60,
}

export type StationType = 'workbench' | 'anvil' | 'furnace' | 'chest' | 'bed';

export type ArmorSlot = 'helmet' | 'chest' | 'legs';

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
  /** Bows: fire arrows from the ammo slot while held. */
  readonly isBow: boolean;
  /** Ammunition (arrows). */
  readonly isAmmo: boolean;
  /** Liquid containers. */
  readonly isBucket: boolean;
  readonly armorSlot: ArmorSlot | null;
  /** Armor damage-reduction points (percentage points of the set total). */
  readonly armorReduction: number;
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
  isBow: false,
  isAmmo: false,
  isBucket: false,
  armorSlot: null,
  armorReduction: 0,
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

function armor(name: string, slot: ArmorSlot, reduction: number, tier: number): ItemDefinition {
  return {
    ...BASE,
    name,
    stackMax: 1,
    tile: null,
    armorSlot: slot,
    armorReduction: reduction,
    tier,
  };
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

  [ItemId.Sandstone]: block('Sandstone', TileId.Sandstone),
  [ItemId.Cactus]: block('Cactus', TileId.Cactus),
  [ItemId.Snow]: block('Snow', TileId.Snow),
  [ItemId.Ice]: block('Ice', TileId.Ice),
  [ItemId.Mud]: block('Mud', TileId.Mud),
  [ItemId.Hardwood]: block('Hardwood', TileId.Hardwood, { fuelValue: 12 }),
  [ItemId.Vine]: block('Vine', TileId.Vine),

  [ItemId.Bow]: item('Bow', { stackMax: 1, isBow: true, tier: 1 }),
  [ItemId.Arrow]: item('Arrow', { stackMax: 200, isAmmo: true }),

  [ItemId.WoodHelmet]: armor('Wood Helmet', 'helmet', 9, 1),
  [ItemId.WoodChestplate]: armor('Wood Chestplate', 'chest', 8, 1),
  [ItemId.WoodLeggings]: armor('Wood Leggings', 'legs', 8, 1),
  [ItemId.IronHelmet]: armor('Iron Helmet', 'helmet', 14, 2),
  [ItemId.IronChestplate]: armor('Iron Chestplate', 'chest', 13, 2),
  [ItemId.IronLeggings]: armor('Iron Leggings', 'legs', 13, 2),
  [ItemId.GoldHelmet]: armor('Gold Helmet', 'helmet', 19, 3),
  [ItemId.GoldChestplate]: armor('Gold Chestplate', 'chest', 18, 3),
  [ItemId.GoldLeggings]: armor('Gold Leggings', 'legs', 18, 3),

  [ItemId.WaterBucket]: item('Water Bucket', { stackMax: 1, isBucket: true }),
  [ItemId.LavaBucket]: item('Lava Bucket', { stackMax: 1, isBucket: true }),
  [ItemId.EmptyBucket]: item('Bucket', { stackMax: 1, isBucket: true }),
  [ItemId.Obsidian]: item('Obsidian'),
  [ItemId.Anvil]: block('Anvil', TileId.Anvil, {
    stackMax: 99,
    station: 'anvil',
    footprint: { w: 2, h: 1 },
  }),
  [ItemId.Bed]: block('Bed', TileId.Bed, {
    stackMax: 99,
    station: 'bed',
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
    case TileId.Anvil:
      return 'anvil';
    case TileId.Furnace:
      return 'furnace';
    case TileId.Chest:
      return 'chest';
    case TileId.Bed:
      return 'bed';
    default:
      return null;
  }
}

export interface BonusDrop {
  readonly item: ItemId;
  readonly chance: number;
  readonly min: number;
  readonly max: number;
}

/** Extra rolls on top of the primary tile drop (e.g. grass sometimes gives rope). */
export const TILE_BONUS_DROPS: Readonly<Partial<Record<TileId, readonly BonusDrop[]>>> = {
  [TileId.Grass]: [{ item: ItemId.Rope, chance: 0.1, min: 1, max: 1 }],
};

export function bonusDropsForTile(tileId: TileId): readonly BonusDrop[] {
  return TILE_BONUS_DROPS[tileId] ?? [];
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
    case TileId.Sandstone:
      return ItemId.Sandstone;
    case TileId.Cactus:
      return ItemId.Cactus;
    case TileId.Snow:
      return ItemId.Snow;
    case TileId.Ice:
      return ItemId.Ice;
    case TileId.Mud:
      return ItemId.Mud;
    case TileId.JungleGrass:
      return ItemId.Mud;
    case TileId.Hardwood:
      return ItemId.Hardwood;
    case TileId.Vine:
      return ItemId.Vine;
    case TileId.Obsidian:
      return ItemId.Obsidian;
    case TileId.Anvil:
      return ItemId.Anvil;
    case TileId.Bed:
      return ItemId.Bed;
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
