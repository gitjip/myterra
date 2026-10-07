import { clamp } from '../core/math';
import { tileDefinition, tileIdFromByte, TileId } from '../data/tiles';
import { LIGHT } from '../data/tuning';
import { liquidTypeFromByte, LiquidType } from './world';
import type { World } from './world';

export interface LightStats {
  /** Cells queued for relighting by the last update. */
  readonly dirty: number;
  /** Queue nodes processed by the last update. */
  readonly nodes: number;
  /** Wall-clock milliseconds of the last update. */
  readonly ms: number;
}

interface Removal {
  readonly i: number;
  readonly level: number;
}

/**
 * Two-channel light: `skyDepth` (distance from full sky, 0 = bright) and
 * `blockLight` (final brightness, 0 = dark). Incremental with a two-phase
 * removal/addition BFS so closing a wall leaves no residual glow.
 */
export class LightSystem {
  public dayFactor: number = LIGHT.dayFactorDay;

  private readonly dirtyCells = new Set<number>();
  private readonly dirtyColumns = new Set<number>();
  private changed: number[] = [];
  private readonly skyRemove: Removal[] = [];
  private readonly blockRemove: Removal[] = [];
  private readonly skyReseed: number[] = [];
  private readonly blockReseed: number[] = [];
  private readonly skyBuckets = new Map<number, number[]>();
  private readonly blockBuckets = new Map<number, number[]>();
  private skyMin = 256;
  private blockMax = 0;
  private nodeCount = 0;
  private statNodes = 0;
  private statDirty = 0;
  private statMs = 0;

  public constructor(private readonly world: World) {}

  public get stats(): LightStats {
    return { dirty: this.statDirty, nodes: this.statNodes, ms: this.statMs };
  }

  /** Queues a cell for relighting. Called from world edit events. */
  public markChanged(x: number, y: number): void {
    this.dirtyCells.add(this.world.idx(x, y));
    this.dirtyColumns.add(clamp(Math.trunc(x), this.world.xMin, this.world.xMax));
  }

  /** Recomputes the whole world. Used on load and by the debug command. */
  public fullRelight(): void {
    const started = performance.now();
    const { world } = this;
    world.skyDepth.fill(255);
    world.blockLight.fill(0);
    this.clearQueues();

    const { width, xMin, xMax, yMin, yMax } = world;
    for (let x = xMin; x <= xMax; x++) {
      const col = x - xMin;
      for (let y: number = yMin; y <= yMax; y++) {
        const idx = (y - yMin) * width + col;
        if (this.blocksLight(idx)) break;
        world.skyDepth[idx] = 0;
      }
    }

    for (let idx = 0; idx < world.fg.length; idx++) {
      if (world.skyDepth[idx] === 0 && this.hasDarkerNeighbour(idx)) this.skyPush(idx, 0);
    }
    this.runSkyAdd();

    for (let idx = 0; idx < world.fg.length; idx++) {
      const source = this.sourceAt(idx);
      if (source > 0) {
        world.blockLight[idx] = source;
        this.blockPush(idx, source);
      }
    }
    this.runBlockAdd();

    this.statNodes = this.nodeCount;
    this.statDirty = 0;
    this.statMs = performance.now() - started;
  }

  /** Processes all pending edits. Returns the last frame's statistics. */
  public update(): LightStats {
    const started = performance.now();
    const hasWork =
      this.dirtyCells.size > 0 ||
      this.dirtyColumns.size > 0 ||
      this.skyRemove.length > 0 ||
      this.blockRemove.length > 0 ||
      this.skyMin <= 255 ||
      this.blockMax > 0;
    if (!hasWork) {
      this.statNodes = 0;
      this.statDirty = 0;
      this.statMs = performance.now() - started;
      return this.stats;
    }

    this.nodeCount = 0;
    this.refreshSkyColumns();
    for (const idx of this.dirtyCells) {
      const level = this.world.blockLight[idx] ?? 0;
      if (level > 0) this.blockRemove.push({ i: idx, level });
    }
    this.statDirty = this.dirtyCells.size;
    this.changed = [...this.dirtyCells];
    this.dirtyCells.clear();
    this.dirtyColumns.clear();

    this.runSkyRemove();
    this.runBlockRemove();
    this.seedAdditions();
    this.runSkyAdd();
    this.runBlockAdd();

    this.statNodes = this.nodeCount;
    this.statMs = performance.now() - started;
    return this.stats;
  }

  // -------------------------------------------------------------------------

  private clearQueues(): void {
    this.skyRemove.length = 0;
    this.blockRemove.length = 0;
    this.skyReseed.length = 0;
    this.blockReseed.length = 0;
    this.skyBuckets.clear();
    this.blockBuckets.clear();
    this.skyMin = 256;
    this.blockMax = 0;
    this.changed = [];
    this.nodeCount = 0;
  }

  private blocksLight(idx: number): boolean {
    return tileDefinition(tileIdFromByte(this.world.fg[idx] ?? 0)).solid;
  }

  private attenuation(idx: number): number {
    return (this.world.liquidAmount[idx] ?? 0) > 0 ? LIGHT.attenuationLiquid : LIGHT.attenuationAir;
  }

  private sourceAt(idx: number): number {
    if (this.world.fg[idx] === TileId.Torch) return LIGHT.torchLight;
    if (
      liquidTypeFromByte(this.world.liquidType[idx] ?? 0) === LiquidType.Lava &&
      (this.world.liquidAmount[idx] ?? 0) > 0
    ) {
      return LIGHT.lavaLight;
    }
    return 0;
  }

  private forEachNeighbour(idx: number, fn: (n: number) => void): void {
    const { width, xMin, xMax, yMin, yMax } = this.world;
    const col = idx % width;
    const row = (idx - col) / width;
    const x = xMin + col;
    const y = yMin + row;
    if (x > xMin) fn(idx - 1);
    if (x < xMax) fn(idx + 1);
    if (y > yMin) fn(idx - width);
    if (y < yMax) fn(idx + width);
  }

  private hasDarkerNeighbour(idx: number): boolean {
    let found = false;
    this.forEachNeighbour(idx, (n) => {
      if (!this.blocksLight(n) && (this.world.skyDepth[n] ?? 255) > 0) found = true;
    });
    return found;
  }

  private skyPush(idx: number, depth: number): void {
    if (depth > 255) return;
    const bucket = this.bucket(this.skyBuckets, depth);
    bucket.push(idx);
    if (depth < this.skyMin) this.skyMin = depth;
  }

  private blockPush(idx: number, level: number): void {
    if (level <= 0) return;
    const bucket = this.bucket(this.blockBuckets, level);
    bucket.push(idx);
    if (level > this.blockMax) this.blockMax = level;
  }

  private bucket(map: Map<number, number[]>, key: number): number[] {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    return bucket;
  }

  private refreshSkyColumns(): void {
    const { width, xMin, yMin, yMax } = this.world;
    for (const x of this.dirtyColumns) {
      const col = x - xMin;
      let direct = true;
      for (let y: number = yMin; y <= yMax; y++) {
        const idx = (y - yMin) * width + col;
        const depth = this.world.skyDepth[idx] ?? 255;
        if (this.blocksLight(idx)) {
          direct = false;
          if (depth === 0) {
            this.world.skyDepth[idx] = 255;
            this.skyRemove.push({ i: idx, level: 0 });
          }
          continue;
        }
        if (direct) {
          if (depth !== 0) {
            this.world.skyDepth[idx] = 0;
            this.skyPush(idx, 0);
          }
        } else if (depth === 0) {
          this.world.skyDepth[idx] = 255;
          this.skyRemove.push({ i: idx, level: 0 });
        }
      }
    }
  }

  private runSkyRemove(): void {
    while (this.skyRemove.length > 0) {
      const entry = this.skyRemove.pop();
      if (!entry) break;
      this.nodeCount++;
      const { i, level } = entry;
      const depth = this.world.skyDepth[i] ?? 255;
      if (depth !== 255 && depth < level) continue;
      this.world.skyDepth[i] = 255;
      this.forEachNeighbour(i, (n) => {
        if (this.blocksLight(n)) return;
        const nd = this.world.skyDepth[n] ?? 255;
        if (nd === 255) return;
        if (nd > level) {
          this.world.skyDepth[n] = 255;
          this.skyRemove.push({ i: n, level: nd });
        } else {
          this.skyReseed.push(n);
        }
      });
    }
  }

  private runBlockRemove(): void {
    while (this.blockRemove.length > 0) {
      const entry = this.blockRemove.pop();
      if (!entry) break;
      this.nodeCount++;
      const { i, level } = entry;
      this.world.blockLight[i] = 0;
      this.forEachNeighbour(i, (n) => {
        if (this.blocksLight(n)) return;
        const nl = this.world.blockLight[n] ?? 0;
        if (nl !== 0 && nl < level) {
          this.world.blockLight[n] = 0;
          this.blockRemove.push({ i: n, level: nl });
        } else if (nl >= level && nl !== 0) {
          this.blockReseed.push(n);
        }
      });
    }
  }

  private seedAdditions(): void {
    for (const idx of this.changed) {
      const source = this.sourceAt(idx);
      if (source > (this.world.blockLight[idx] ?? 0)) {
        this.world.blockLight[idx] = source;
        this.blockPush(idx, source);
      }
      if (this.blocksLight(idx)) continue;
      this.forEachNeighbour(idx, (n) => {
        if (this.blocksLight(n)) return;
        const nl = this.world.blockLight[n] ?? 0;
        if (nl > 0) this.blockPush(n, nl);
        const nd = this.world.skyDepth[n] ?? 255;
        if (nd !== 255) this.skyPush(n, nd);
      });
    }
    for (const n of this.blockReseed) {
      if (!this.blocksLight(n)) {
        const nl = this.world.blockLight[n] ?? 0;
        if (nl > 0) this.blockPush(n, nl);
      }
    }
    this.blockReseed.length = 0;
    for (const n of this.skyReseed) {
      const nd = this.world.skyDepth[n] ?? 255;
      if (!this.blocksLight(n) && nd !== 255) this.skyPush(n, nd);
    }
    this.skyReseed.length = 0;
  }

  private runSkyAdd(): void {
    while (this.skyMin <= 255) {
      const bucket = this.skyBuckets.get(this.skyMin);
      if (!bucket || bucket.length === 0) {
        this.skyMin++;
        continue;
      }
      const idx = bucket.pop();
      if (idx === undefined) {
        this.skyMin++;
        continue;
      }
      const depth = this.skyMin;
      this.nodeCount++;
      if ((this.world.skyDepth[idx] ?? 255) < depth) continue;
      this.forEachNeighbour(idx, (n) => {
        if (this.blocksLight(n)) return;
        const nd = depth + this.attenuation(n);
        if (nd < (this.world.skyDepth[n] ?? 255)) {
          this.world.skyDepth[n] = nd;
          this.skyPush(n, nd);
        }
      });
    }
  }

  private runBlockAdd(): void {
    while (this.blockMax > 0) {
      const bucket = this.blockBuckets.get(this.blockMax);
      if (!bucket || bucket.length === 0) {
        this.blockMax--;
        continue;
      }
      const idx = bucket.pop();
      if (idx === undefined) {
        this.blockMax--;
        continue;
      }
      const level = this.blockMax;
      this.nodeCount++;
      if ((this.world.blockLight[idx] ?? 0) !== level) continue;
      this.forEachNeighbour(idx, (n) => {
        if (this.blocksLight(n)) return;
        const nl = level - this.attenuation(n);
        if (nl > (this.world.blockLight[n] ?? 0)) {
          this.world.blockLight[n] = nl;
          this.blockPush(n, nl);
        }
      });
    }
  }
}
