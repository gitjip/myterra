/** Foreground tile ids. */
export enum TileId {
  Air = 0,
  Dirt = 1,
  Stone = 2,
  Grass = 3,
  Wood = 4,
  Leaf = 5,
  Sand = 6,
  Torch = 7,
  DoorTopClosed = 8,
  DoorTopOpen = 9,
  DoorBottomClosed = 10,
  DoorBottomOpen = 11,
  Bedrock = 12,
  CoalOre = 13,
  IronOre = 14,
  GoldOre = 15,
}

/** Background wall ids. Walls never participate in collision or lighting. */
export enum WallId {
  None = 0,
  Dirt = 1,
  Stone = 2,
}

/** Tool classes. `null` means a tile can be worked bare-handed. */
export type ToolClass = 'pickaxe' | 'axe' | 'hammer' | 'shovel';

export interface TileDefinition {
  readonly solid: boolean;
  readonly passable: boolean;
  readonly hardness: number;
  /** Preferred tool class; used for the wrong-tool penalty and drop rule. */
  readonly tool: ToolClass | null;
  /** When true the tile cannot be mined without a tool at all. */
  readonly requiresTool: boolean;
  readonly unbreakable: boolean;
  readonly liquidHostile: boolean;
}

function tile(
  solid: boolean,
  passable: boolean,
  hardness: number,
  tool: ToolClass | null,
  requiresTool = false,
  unbreakable = false,
): TileDefinition {
  return { solid, passable, hardness, tool, requiresTool, unbreakable, liquidHostile: false };
}

const AIR = tile(false, true, 0, null);

export const TILE_DEFINITIONS: Readonly<Partial<Record<TileId, TileDefinition>>> = {
  [TileId.Air]: AIR,
  [TileId.Dirt]: tile(true, false, 0.5, 'shovel'),
  [TileId.Stone]: tile(true, false, 3, 'pickaxe', true),
  [TileId.Grass]: tile(true, false, 0.6, 'shovel'),
  [TileId.Wood]: tile(true, false, 2, 'axe'),
  [TileId.Leaf]: tile(false, true, 0.2, 'axe'),
  [TileId.Sand]: tile(true, false, 0.5, 'shovel'),
  [TileId.Torch]: tile(false, true, 0, null),
  [TileId.DoorTopClosed]: tile(true, false, 1, null),
  [TileId.DoorTopOpen]: tile(false, true, 1, null),
  [TileId.DoorBottomClosed]: tile(true, false, 1, null),
  [TileId.DoorBottomOpen]: tile(false, true, 1, null),
  [TileId.Bedrock]: tile(true, false, Number.POSITIVE_INFINITY, null, false, true),
  [TileId.CoalOre]: tile(true, false, 2.5, 'pickaxe', true),
  [TileId.IronOre]: tile(true, false, 3.5, 'pickaxe', true),
  [TileId.GoldOre]: tile(true, false, 4, 'pickaxe', true),
};

export function tileDefinition(tileId: TileId): TileDefinition {
  return TILE_DEFINITIONS[tileId] ?? AIR;
}

export function tileIdFromByte(value: number): TileId {
  switch (value) {
    case 0:
      return TileId.Air;
    case 1:
      return TileId.Dirt;
    case 2:
      return TileId.Stone;
    case 3:
      return TileId.Grass;
    case 4:
      return TileId.Wood;
    case 5:
      return TileId.Leaf;
    case 6:
      return TileId.Sand;
    case 7:
      return TileId.Torch;
    case 8:
      return TileId.DoorTopClosed;
    case 9:
      return TileId.DoorTopOpen;
    case 10:
      return TileId.DoorBottomClosed;
    case 11:
      return TileId.DoorBottomOpen;
    case 12:
      return TileId.Bedrock;
    case 13:
      return TileId.CoalOre;
    case 14:
      return TileId.IronOre;
    case 15:
      return TileId.GoldOre;
    default:
      return TileId.Air;
  }
}

export function wallIdFromByte(value: number): WallId {
  switch (value) {
    case 1:
      return WallId.Dirt;
    case 2:
      return WallId.Stone;
    default:
      return WallId.None;
  }
}

/** True for any of the four door tiles. */
export function isDoorTile(tileId: TileId): boolean {
  return (
    tileId === TileId.DoorTopClosed ||
    tileId === TileId.DoorTopOpen ||
    tileId === TileId.DoorBottomClosed ||
    tileId === TileId.DoorBottomOpen
  );
}
