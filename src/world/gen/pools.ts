import { hash2 } from '../../core/rng';
import { TileId } from '../../data/tiles';
import { GEN } from '../../data/tuning';
import { LiquidType } from '../world';
import type { World } from '../world';

/**
 * Static pools. There is no liquid simulation until M8; this fills the bottom
 * of a sparse selection of underground cave runs, leaving them at rest.
 */
export function fillColumnPools(world: World, x: number, surface: number, seed: number): void {
  // Only a fraction of columns host a pool, so total volume (and settle time) stays bounded.
  if (hash2(x, 0, seed + 31337) >= 0.12) return;

  const column = x - world.xMin;
  const endY = world.yMax - GEN.bedrockMargin - 1;
  let y = Math.max(world.yMin, surface + GEN.waterLevelOffset);

  while (y <= endY) {
    const i = (y - world.yMin) * world.width + column;
    if (world.fg[i] !== TileId.Air) {
      y++;
      continue;
    }

    const runStart = y;
    while (y <= endY && world.fg[(y - world.yMin) * world.width + column] === TileId.Air) y++;
    const runEnd = y - 1;

    const below = runEnd + 1;
    const belowIndex = (below - world.yMin) * world.width + column;
    const floorSolid = world.fg[belowIndex] !== TileId.Air;
    const openTop = runEnd - runStart + 1;
    if (floorSolid && openTop >= 3) {
      const fill = Math.min(2, openTop);
      const lava = runEnd - surface > GEN.lavaDepth;
      const type = lava ? LiquidType.Lava : LiquidType.Water;
      for (let k = 0; k < fill; k++) {
        const fillY = runEnd - k;
        const fi = (fillY - world.yMin) * world.width + column;
        world.liquidType[fi] = type;
        world.liquidAmount[fi] = 100;
      }
    }
  }
}
