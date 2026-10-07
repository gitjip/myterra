/** Foreground tile ids used by the M1 test scene and later systems. */
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
}

/** Background wall ids. Walls never participate in collision or lighting. */
export enum WallId {
  None = 0,
  Dirt = 1,
  Stone = 2,
}

export interface TileDefinition {
  readonly solid: boolean;
  readonly passable: boolean;
  readonly hardness: number;
  readonly drop: TileId | null;
  readonly liquidHostile: boolean;
}

const solid = (hardness: number, drop: TileId | null = null): TileDefinition => ({
  solid: true,
  passable: false,
  hardness,
  drop,
  liquidHostile: false,
});

const passable = (hardness: number, drop: TileId | null = null): TileDefinition => ({
  solid: false,
  passable: true,
  hardness,
  drop,
  liquidHostile: false,
});

const AIR_DEFINITION = passable(0);

export const TILE_DEFINITIONS: Readonly<Partial<Record<TileId, TileDefinition>>> = {
  [TileId.Air]: AIR_DEFINITION,
  [TileId.Dirt]: solid(0.5, TileId.Dirt),
  [TileId.Stone]: solid(3, TileId.Stone),
  [TileId.Grass]: solid(0.6, TileId.Dirt),
  [TileId.Wood]: solid(2, TileId.Wood),
  [TileId.Leaf]: passable(0.2, TileId.Leaf),
  [TileId.Sand]: solid(0.5, TileId.Sand),
  [TileId.Torch]: passable(0, TileId.Torch),
  [TileId.DoorTopClosed]: solid(1, null),
  [TileId.DoorTopOpen]: passable(1, null),
  [TileId.DoorBottomClosed]: solid(1, null),
  [TileId.DoorBottomOpen]: passable(1, null),
  [TileId.Bedrock]: solid(Number.POSITIVE_INFINITY, null),
};

export function tileDefinition(tile: TileId): TileDefinition {
  return TILE_DEFINITIONS[tile] ?? AIR_DEFINITION;
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
