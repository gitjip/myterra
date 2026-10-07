import { hash2 } from '../../core/rng';
import { biomeParamsAt } from '../../data/biomes';
import { TileId } from '../../data/tiles';
import type { World } from '../world';
import { surfaceAt } from './terrain';

/** Minimum columns between two tree trunks. */
export const TREE_MIN_SPACING = 3;

export interface FloraState {
  lastTreeX: number;
}

export function newFloraState(): FloraState {
  return { lastTreeX: -1e9 };
}

/** Grows a tree on this column when the biome and spacing allow. */
export function plantColumn(world: World, x: number, seed: number, state: FloraState): void {
  if (!world.inReach(x, 0)) return;
  const biome = biomeParamsAt(x, seed);
  if (biome.treeChance <= 0) return;
  if (x - state.lastTreeX < TREE_MIN_SPACING) return;
  if (hash2(x, 0, seed + 4242) >= biome.treeChance) return;

  state.lastTreeX = x;
  growTree(world, x, seed, biome.trunk, biome.leaf, biome.leafRadius);
}

function growTree(
  world: World,
  x: number,
  seed: number,
  trunk: TileId,
  leaf: TileId,
  radius: number,
): void {
  const surface = surfaceAt(x, seed);
  const height = 4 + Math.floor(hash2(x, 1, seed + 99) * 3);

  for (let i = 0; i < height; i++) {
    const y = surface - 1 - i;
    if (!world.inReach(x, y)) break;
    if (world.getTile(x, y) === TileId.Air) world.setTile(x, y, trunk);
  }

  const centreY = surface - height;
  for (let dy = -1; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
      const y = centreY + dy;
      if (!world.inReach(x + dx, y)) continue;
      if (world.getTile(x + dx, y) === TileId.Air) world.setTile(x + dx, y, leaf);
    }
  }
}
