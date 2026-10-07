import { TILE, WORLD, totalWidthFor } from '../data/tuning';

export const TILE_PX = TILE.px;
export const CHUNK = TILE.chunk;
export const BUFFER_CHUNKS = TILE.bufferChunks;
export const BUFFER_TILES = TILE.bufferTiles;
export const Y_MIN = WORLD.yMin;
export const Y_MAX = WORLD.yMax;
export const Y_REACH_MIN = WORLD.yReachMin;
export const Y_REACH_MAX = WORLD.yReachMax;

export const WORLD_HEIGHT = Y_MAX - Y_MIN + 1;

export interface WorldSize {
  readonly reachWidth: number;
}

export function totalWorldWidth(reachWidth: number): number {
  return totalWidthFor(reachWidth);
}

export function worldXMin(): number {
  return -BUFFER_TILES;
}

export function worldXMax(reachWidth: number): number {
  return reachWidth + BUFFER_TILES - 1;
}
