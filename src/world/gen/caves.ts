import { TileId } from '../../data/tiles';
import { GEN } from '../../data/tuning';
import { LiquidType } from '../world';
import type { World } from '../world';
import { blob3D, ridged2D } from './noise';

/**
 * Caves are a pure function of (x, y, seed, surface). No per-column state, so
 * two independent generations agree across a chunk boundary.
 */
export function isCave(x: number, y: number, surface: number, seed: number): boolean {
  if (y <= surface + GEN.caveMinDepth) return false;
  const ridge = ridged2D(x * 0.012, y * 0.02, seed, 3);
  if (ridge > GEN.caveThreshold) return true;
  if (y > surface + 24) {
    const hall = blob3D(x * 0.02, y * 0.02, 0.5, seed + 7777);
    if (hall > GEN.hallThreshold) return true;
  }
  return false;
}

export function carveColumnCaves(world: World, x: number, surface: number, seed: number): void {
  const column = x - world.xMin;
  const floor = world.yMax - GEN.bedrockMargin;
  for (let y = Math.max(world.yMin, surface + GEN.caveMinDepth + 1); y <= floor; y++) {
    if (!isCave(x, y, surface, seed)) continue;
    const i = (y - world.yMin) * world.width + column;
    if (world.fg[i] === TileId.Bedrock) continue;
    world.fg[i] = TileId.Air;
    world.liquidType[i] = LiquidType.None;
    world.liquidAmount[i] = 0;
  }
}
