import { TEST_WORLD } from '../data/tuning';
import { TileId, WallId } from '../data/tiles';
import { World } from './world';

/** Small deterministic scene used until the real generator lands in M5. */
export function createTestWorld(reachWidth: number = TEST_WORLD.reachWidth): World {
  const world = new World({ reachWidth });
  const surface: number = TEST_WORLD.surfaceY;
  const bedrock: number = TEST_WORLD.height - 1;
  const wallX: number = Math.floor(reachWidth / 2) + TEST_WORLD.wallXOffset;

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

  return world;
}
