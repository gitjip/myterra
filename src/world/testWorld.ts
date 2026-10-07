import { TEST_WORLD } from '../data/tuning';
import { TileId, WallId } from '../data/tiles';
import { LiquidType, World } from './world';

/**
 * Small deterministic scene used until the real generator lands in M5.
 *
 * It is flat ground with a stone wall, a static water pool and bedrock, enough
 * to exercise player physics, swimming and the survival timers by hand.
 */
export function createTestWorld(reachWidth: number = TEST_WORLD.reachWidth): World {
  const world = new World({ reachWidth });
  const surface: number = TEST_WORLD.surfaceY;
  const bedrock: number = TEST_WORLD.height - 1;
  const centre: number = Math.floor(reachWidth / 2);
  const wallX: number = centre + TEST_WORLD.wallXOffset;

  for (let x = world.xMin; x <= world.xMax; x++) {
    for (let y = surface; y <= bedrock; y++) {
      let tile = TileId.Stone;
      if (y === bedrock) tile = TileId.Bedrock;
      else if (y === surface) tile = TileId.Grass;
      else if (y < surface + 4) tile = TileId.Dirt;
      world.setTile(x, y, tile);
      if (y < bedrock) world.setWall(x, y, y < surface + 4 ? WallId.Dirt : WallId.Stone);
    }
  }

  for (let y = surface - 8; y < surface; y++) {
    world.setTile(wallX, y, TileId.Stone);
  }

  const poolLeft = centre + TEST_WORLD.poolXOffset - TEST_WORLD.poolHalfWidth;
  const poolRight = centre + TEST_WORLD.poolXOffset + TEST_WORLD.poolHalfWidth;
  for (let x = poolLeft; x <= poolRight; x++) {
    for (let y = surface; y < surface + TEST_WORLD.poolDepth; y++) {
      world.setTile(x, y, TileId.Air);
      world.setLiquid(x, y, LiquidType.Water, 100);
    }
  }

  return world;
}

/** Ground-top tile coordinate where the player spawns, clear of the pool. */
export function testSpawnPoint(reachWidth: number = TEST_WORLD.reachWidth): {
  x: number;
  y: number;
} {
  return { x: Math.floor(reachWidth / 2) + TEST_WORLD.spawnXOffset, y: TEST_WORLD.surfaceY };
}
