import { TileId } from '../../data/tiles';
import { GEN } from '../../data/tuning';
import { LiquidType } from '../world';
import type { World } from '../world';

/**
 * Static pools. There is no liquid simulation until M8, so this just fills the
 * bottom of underground cave runs and leaves the cells at rest.
 */
export function fillColumnPools(world: World, x: number, surface: number): void {
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
    if (floorSolid && openTop >= 2) {
      const fill = Math.min(GEN.waterPoolDepth, openTop);
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
