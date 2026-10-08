import { TileId } from './tiles';
import { GEN } from './tuning';

/**
 * Biome identity and per-biome tables. Biomes are horizontal bands with a
 * blended transition so terrain height does not step at a boundary.
 */
export enum BiomeId {
  Forest = 0,
  Desert = 1,
  Snow = 2,
  Jungle = 3,
}

export type TreeKind = 'oak' | 'pine' | 'jungle' | 'cactus' | 'none';

export interface BiomeDefinition {
  readonly id: BiomeId;
  readonly name: string;
  readonly surface: TileId;
  readonly subsurface: TileId;
  /** Elevation bias in rows; positive is higher ground. */
  readonly elevation: number;
  /** Multiplier on the hill amplitude. */
  readonly hillScale: number;
  readonly treeKind: TreeKind;
  /** Probability per eligible column of growing a tree. */
  readonly treeChance: number;
  /** Extra chance of a cactus, for the desert. */
  readonly cactusChance: number;
  /** Chance that a jungle tree edge grows a hanging vine. */
  readonly vineChance: number;
  readonly trunk: TileId;
  readonly leaf: TileId;
  readonly leafRadius: number;
}

export const BIOMES: Readonly<Record<BiomeId, BiomeDefinition>> = {
  [BiomeId.Forest]: {
    id: BiomeId.Forest,
    name: 'Forest',
    surface: TileId.Grass,
    subsurface: TileId.Dirt,
    elevation: 0,
    hillScale: 1,
    treeKind: 'oak',
    treeChance: 0.12,
    cactusChance: 0,
    vineChance: 0,
    trunk: TileId.Wood,
    leaf: TileId.Leaf,
    leafRadius: 2,
  },
  [BiomeId.Desert]: {
    id: BiomeId.Desert,
    name: 'Desert',
    surface: TileId.Sand,
    subsurface: TileId.Sandstone,
    elevation: -2,
    hillScale: 0.5,
    treeKind: 'cactus',
    treeChance: 0,
    cactusChance: 0.16,
    vineChance: 0,
    trunk: TileId.Cactus,
    leaf: TileId.Cactus,
    leafRadius: 0,
  },
  [BiomeId.Snow]: {
    id: BiomeId.Snow,
    name: 'Snow',
    surface: TileId.Snow,
    subsurface: TileId.Ice,
    elevation: 3,
    hillScale: 1.3,
    treeKind: 'pine',
    treeChance: 0.08,
    cactusChance: 0,
    vineChance: 0,
    trunk: TileId.Hardwood,
    leaf: TileId.Leaf,
    leafRadius: 2,
  },
  [BiomeId.Jungle]: {
    id: BiomeId.Jungle,
    name: 'Jungle',
    surface: TileId.JungleGrass,
    subsurface: TileId.Mud,
    elevation: -1,
    hillScale: 1.1,
    treeKind: 'jungle',
    treeChance: 0.24,
    cactusChance: 0,
    vineChance: 0.35,
    trunk: TileId.Hardwood,
    leaf: TileId.Leaf,
    leafRadius: 3,
  },
};

export const BIOME_BAND_WIDTH = 384;

const BIOME_ORDER: readonly BiomeId[] = [
  BiomeId.Forest,
  BiomeId.Desert,
  BiomeId.Snow,
  BiomeId.Jungle,
];

export function biomeDefinition(id: BiomeId): BiomeDefinition {
  return BIOMES[id];
}

export interface BiomeSample {
  /** The band the column is officially in. */
  readonly primary: BiomeId;
  /** The neighbouring band it blends toward near an edge. */
  readonly secondary: BiomeId;
  /** Weight of the secondary biome, 0 in a band's interior. */
  readonly blend: number;
}

function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}

function bandId(index: number): BiomeId {
  return BIOME_ORDER[mod(index, BIOME_ORDER.length)] ?? BiomeId.Forest;
}

/**
 * Samples the biome band at world column `x`. The transition zone blends the
 * two adjacent bands with a smoothstep, so callers can interpolate height.
 */
export function sampleBiome(x: number, seed: number): BiomeSample {
  const offset = mod(seed, BIOME_BAND_WIDTH);
  const u = (x + offset) / BIOME_BAND_WIDTH;
  const index = Math.floor(u);
  const frac = u - index;
  const primary = bandId(index);
  const transition = GEN.biomeTransitionTiles / BIOME_BAND_WIDTH;

  if (frac < transition) {
    const t = frac / transition;
    return { primary, secondary: bandId(index - 1), blend: 1 - t * t * (3 - 2 * t) };
  }
  if (frac > 1 - transition) {
    const t = (frac - (1 - transition)) / transition;
    return { primary, secondary: bandId(index + 1), blend: t * t * (3 - 2 * t) };
  }
  return { primary, secondary: primary, blend: 0 };
}

export function biomeAt(x: number, seed: number): BiomeId {
  return sampleBiome(x, seed).primary;
}

export function lerpBiome(a: BiomeId, b: BiomeId, t: number): BiomeDefinition {
  const da = biomeDefinition(a);
  const db = biomeDefinition(b);
  if (t <= 0) return da;
  if (t >= 1) return db;
  return {
    ...da,
    surface: t < 0.5 ? da.surface : db.surface,
    subsurface: t < 0.5 ? da.subsurface : db.subsurface,
    elevation: da.elevation + (db.elevation - da.elevation) * t,
    hillScale: da.hillScale + (db.hillScale - da.hillScale) * t,
    treeKind: t < 0.5 ? da.treeKind : db.treeKind,
    treeChance: da.treeChance + (db.treeChance - da.treeChance) * t,
    cactusChance: da.cactusChance + (db.cactusChance - da.cactusChance) * t,
    vineChance: da.vineChance + (db.vineChance - da.vineChance) * t,
    trunk: t < 0.5 ? da.trunk : db.trunk,
    leaf: t < 0.5 ? da.leaf : db.leaf,
    leafRadius: t < 0.5 ? da.leafRadius : db.leafRadius,
  };
}

/** Blended biome parameters at a column. */
export function biomeParamsAt(x: number, seed: number): BiomeDefinition {
  const sample = sampleBiome(x, seed);
  return lerpBiome(sample.primary, sample.secondary, sample.blend);
}
