import { TileId } from '../../data/tiles';
import { GEN, WORLD } from '../../data/tuning';
import { World } from '../world';
import { carveColumnCaves } from './caves';
import type { FloraState } from './flora';
import { newFloraState, plantColumn } from './flora';
import { applyColumnOres } from './ores';
import { fillColumnPools } from './pools';
import { generateColumnTerrain, surfaceAt } from './terrain';

export interface SpawnPoint {
  readonly x: number;
  /** Row of the ground tile the player stands on. */
  readonly y: number;
}

const SURFACE_TILES = new Set<TileId>([TileId.Grass, TileId.Dirt, TileId.Sand]);

const PHASE_COUNT = 3;

/**
 * Incremental, cancellable world generation. Columns are produced in three
 * passes so trees can be placed on finished terrain. It writes world arrays
 * directly (the generation exception to the setTile rule) and bumps the render
 * revision once when done.
 */
export class WorldGenerator {
  public readonly world: World;
  public readonly seed: number;
  private readonly flora: FloraState = newFloraState();
  private cursor = 0;
  private phase = 0;
  private finishedFlag: boolean = false;
  private cancelledFlag: boolean = false;

  public constructor(seed: number, reachWidth: number) {
    this.seed = seed >>> 0;
    this.world = new World({ reachWidth });
  }

  public get done(): boolean {
    return this.finishedFlag;
  }

  public get cancelled(): boolean {
    return this.cancelledFlag;
  }

  /** 0..1 across all three passes. */
  public get progress(): number {
    const total = this.world.reachWidth * PHASE_COUNT;
    if (total === 0) return 1;
    const completed = this.phase * this.world.reachWidth + this.cursor;
    return Math.min(1, completed / total);
  }

  public cancel(): void {
    this.cancelledFlag = true;
  }

  /** Advances generation for at most `budgetMs` milliseconds. */
  public step(budgetMs: number): void {
    if (this.finishedFlag || this.cancelledFlag) return;
    const started = performance.now();
    let finished = false;
    while (!finished && performance.now() - started < budgetMs) {
      finished = this.advance();
    }
    if (finished) {
      this.world.bumpRevision();
      this.world.clearDirty();
    }
  }

  /** Generates synchronously. For tests and headless use. */
  public runToCompletion(): World {
    while (!this.finishedFlag && !this.cancelledFlag) this.advance();
    if (this.finishedFlag) {
      this.world.bumpRevision();
      this.world.clearDirty();
    }
    return this.world;
  }

  private advance(): boolean {
    const width = this.world.reachWidth;
    if (this.phase === 0) {
      if (this.cursor >= width) {
        this.phase = 1;
        this.cursor = 0;
        return false;
      }
      const x = this.cursor;
      const surface = surfaceAt(x, this.seed);
      generateColumnTerrain(this.world, x, this.seed);
      carveColumnCaves(this.world, x, surface, this.seed);
      applyColumnOres(this.world, x, surface, this.seed);
      this.cursor++;
      return false;
    }
    if (this.phase === 1) {
      if (this.cursor >= width) {
        this.phase = 2;
        this.cursor = 0;
        return false;
      }
      plantColumn(this.world, this.cursor, this.seed, this.flora);
      this.cursor++;
      return false;
    }
    if (this.cursor >= width) {
      this.finishedFlag = true;
      return true;
    }
    const x = this.cursor;
    fillColumnPools(this.world, x, surfaceAt(x, this.seed), this.seed);
    this.cursor++;
    return false;
  }
}

/** First reachable column with three air rows above solid ground. */
export function findSpawn(world: World): SpawnPoint {
  for (let x = 0; x < world.reachWidth; x++) {
    for (let y: number = WORLD.yReachMin; y <= WORLD.yReachMax; y++) {
      if (!world.isSolid(x, y)) continue;
      const tile = world.getTile(x, y);
      if (
        SURFACE_TILES.has(tile) &&
        y - 3 >= WORLD.yReachMin &&
        !world.isSolid(x, y - 1) &&
        !world.isSolid(x, y - 2) &&
        !world.isSolid(x, y - 3)
      ) {
        return { x, y };
      }
      break;
    }
  }
  return { x: 0, y: GEN.surfaceY };
}
