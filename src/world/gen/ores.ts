import { TileId } from '../../data/tiles';
import { GEN } from '../../data/tuning';
import type { World } from '../world';
import { blob3D } from './noise';

interface OreDefinition {
  readonly tile: TileId;
  /** Third blobbing axis, so each ore has an independent field. */
  readonly axis: number;
  readonly band: readonly [number, number];
}

/** Ordered by precedence: a deeper, rarer ore wins where bands overlap. */
const ORES: readonly OreDefinition[] = [
  { tile: TileId.GoldOre, axis: 37, band: GEN.goldBand },
  { tile: TileId.IronOre, axis: 23, band: GEN.ironBand },
  { tile: TileId.CoalOre, axis: 11, band: GEN.coalBand },
];

/** Returns the ore tile for a stone cell at depth `y - surface`, or null. */
export function oreAt(x: number, y: number, depth: number, seed: number): TileId | null {
  for (const ore of ORES) {
    if (depth < ore.band[0] || depth > ore.band[1]) continue;
    const blob = blob3D(x * 0.07, y * 0.07, ore.axis, seed + ore.axis * 131);
    if (blob > GEN.oreThreshold) return ore.tile;
  }
  return null;
}

/** Replaces stone in one column with ore where the veins cover it. */
export function applyColumnOres(world: World, x: number, surface: number, seed: number): void {
  const column = x - world.xMin;
  for (let y: number = world.yMin; y <= world.yMax; y++) {
    const i = (y - world.yMin) * world.width + column;
    if (world.fg[i] !== TileId.Stone) continue;
    const ore = oreAt(x, y, y - surface, seed);
    if (ore !== null) world.fg[i] = ore;
  }
}
