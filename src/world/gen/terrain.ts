import { biomeParamsAt } from '../../data/biomes';
import { TileId, WallId } from '../../data/tiles';
import { GEN } from '../../data/tuning';
import type { World } from '../world';
import { fbm1D } from './noise';

/** Height field, in tile rows; smaller y is higher ground. */
export function surfaceAt(x: number, seed: number): number {
  const biome = biomeParamsAt(x, seed);
  const hills = (fbm1D(x * 0.006, seed, 4) - 0.5) * 2 * GEN.hillAmplitude * biome.hillScale;
  const detail = (fbm1D(x * 0.05, seed + 9001, 2) - 0.5) * 2 * GEN.hillDetail;
  return Math.round(GEN.surfaceY - (biome.elevation + hills + detail));
}

/**
 * Fills one column with surface, subsurface, stone, bedrock and background
 * walls. Caves, ores, flora and pools are separate passes on top.
 */
export function generateColumnTerrain(world: World, x: number, seed: number): void {
  const surface = surfaceAt(x, seed);
  const biome = biomeParamsAt(x, seed);
  const column = x - world.xMin;
  const dirtBottom = surface + GEN.dirtDepth;

  for (let y: number = world.yMin; y <= world.yMax; y++) {
    const i = (y - world.yMin) * world.width + column;
    if (y === world.yMax) {
      world.fg[i] = TileId.Bedrock;
      world.wall[i] = WallId.None;
    } else if (y === surface) {
      world.fg[i] = biome.surface;
      world.wall[i] = WallId.None;
    } else if (y > surface) {
      world.fg[i] = y <= dirtBottom ? biome.subsurface : TileId.Stone;
      world.wall[i] = y <= dirtBottom ? WallId.Dirt : WallId.Stone;
    } else {
      world.fg[i] = TileId.Air;
      world.wall[i] = WallId.None;
    }
  }
}
