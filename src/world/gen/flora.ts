import { hash2 } from '../../core/rng';
import { biomeParamsAt } from '../../data/biomes';
import { TileId } from '../../data/tiles';
import type { World } from '../world';
import { surfaceAt } from './terrain';

/** Minimum columns between two trunks or cacti. */
export const TREE_MIN_SPACING = 3;

export interface FloraState {
  lastTreeX: number;
}

export function newFloraState(): FloraState {
  return { lastTreeX: -1e9 };
}

/** Grows a tree, cactus or vine on this column when the biome allows. */
export function plantColumn(world: World, x: number, seed: number, state: FloraState): void {
  if (!world.inReach(x, 0)) return;
  const biome = biomeParamsAt(x, seed);
  const chance = biome.treeKind === 'cactus' ? biome.cactusChance : biome.treeChance;
  if (chance <= 0) return;
  if (x - state.lastTreeX < TREE_MIN_SPACING) return;
  if (hash2(x, 0, seed + 4242) >= chance) return;

  state.lastTreeX = x;
  switch (biome.treeKind) {
    case 'cactus':
      growCactus(world, x, seed);
      break;
    case 'pine':
      growPine(world, x, seed, biome.leaf);
      break;
    case 'jungle':
      growJungle(world, x, seed, biome.leafRadius, biome.vineChance);
      break;
    case 'oak':
      growOak(world, x, seed, biome.trunk, biome.leaf, biome.leafRadius);
      break;
    default:
      break;
  }
}

function trunkHeight(x: number, seed: number, min: number, span: number): number {
  return min + Math.floor(hash2(x, 1, seed + 99) * span);
}

function placeTrunk(world: World, x: number, surface: number, height: number, tile: TileId): void {
  for (let i = 0; i < height; i++) {
    const y = surface - 1 - i;
    if (!world.inReach(x, y)) break;
    if (world.getTile(x, y) === TileId.Air) world.setTile(x, y, tile);
  }
}

function placeLeaf(world: World, x: number, y: number, tile: TileId): void {
  if (!world.inReach(x, y)) return;
  if (world.getTile(x, y) === TileId.Air) world.setTile(x, y, tile);
}

function growOak(
  world: World,
  x: number,
  seed: number,
  trunk: TileId,
  leaf: TileId,
  radius: number,
): void {
  const surface = surfaceAt(x, seed);
  const height = trunkHeight(x, seed, 4, 3);
  placeTrunk(world, x, surface, height, trunk);
  const centreY = surface - height;
  for (let dy = -1; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
      placeLeaf(world, x + dx, centreY + dy, leaf);
    }
  }
}

function growPine(world: World, x: number, seed: number, leaf: TileId): void {
  const surface = surfaceAt(x, seed);
  const height = trunkHeight(x, seed, 6, 3);
  placeTrunk(world, x, surface, height, TileId.Hardwood);
  const topY = surface - height;
  for (let layer = 0; layer <= 3; layer++) {
    const r = 3 - layer;
    const y = topY - 1 + layer;
    for (let dx = -r; dx <= r; dx++) placeLeaf(world, x + dx, y, leaf);
  }
}

function growJungle(
  world: World,
  x: number,
  seed: number,
  radius: number,
  vineChance: number,
): void {
  const surface = surfaceAt(x, seed);
  const height = trunkHeight(x, seed, 6, 4);
  placeTrunk(world, x, surface, height, TileId.Hardwood);
  const centreY = surface - height;
  for (let dy = -1; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
      placeLeaf(world, x + dx, centreY + dy, TileId.Leaf);
    }
  }
  // Hanging vines from the canopy underside.
  const bottomY = centreY + radius - 1;
  for (let dx = -radius; dx <= radius; dx++) {
    if (hash2(x + dx, 2, seed + 777) >= vineChance) continue;
    const length = 2 + Math.floor(hash2(x + dx, 3, seed + 555) * 4);
    for (let k = 0; k < length; k++) {
      const y = bottomY + k;
      if (world.getTile(x + dx, y) !== TileId.Air) break;
      placeLeaf(world, x + dx, y, TileId.Vine);
    }
  }
}

function growCactus(world: World, x: number, seed: number): void {
  const surface = surfaceAt(x, seed);
  const height = trunkHeight(x, seed, 2, 3);
  for (let i = 0; i < height; i++) {
    const y = surface - 1 - i;
    if (!world.inReach(x, y)) break;
    if (world.getTile(x, y) === TileId.Air) world.setTile(x, y, TileId.Cactus);
  }
}
