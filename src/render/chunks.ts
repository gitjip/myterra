import { FRAME_BUDGET_MS, RENDER, TILE } from '../data/tuning';
import { TileId, WallId } from '../data/tiles';
import { CHUNK } from '../world/constants';
import type { World } from '../world/world';
import type { Camera } from './camera';
import type { TileAtlas } from './atlas';

interface ChunkCacheEntry {
  readonly canvas: HTMLCanvasElement;
  /** Rebuild needed. */
  dirty: boolean;
  /** Has been built at least once. */
  built: boolean;
}

export interface ChunkRenderStats {
  readonly chunksVisible: number;
  readonly chunksDrawn: number;
  readonly chunksRebuilt: number;
  readonly drawnTiles: number;
}

/**
 * Visible chunk cache. Each chunk tracks its own dirtiness from world edit
 * events, so a single mined block does not invalidate the whole viewport. A
 * chunk that runs out of rebuild budget is still drawn from its old canvas
 * (never skipped) to avoid flicker, and off-screen canvases are evicted and
 * pooled.
 */
export class ChunkRenderer {
  private readonly cache = new Map<string, ChunkCacheEntry>();
  private readonly pool: HTMLCanvasElement[] = [];
  private readonly world: World;
  private readonly atlas: TileAtlas;
  private readonly unsubscribe: () => void;

  public constructor(world: World, atlas: TileAtlas) {
    this.world = world;
    this.atlas = atlas;
    this.unsubscribe = world.emitter.on('tile', ({ x, y }) => {
      this.markDirty(x, y);
    });
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    countTiles = false,
  ): ChunkRenderStats {
    const visible = camera.visibleRect();
    const minChunkX = this.chunkX(visible.minX);
    const maxChunkX = this.chunkX(visible.maxX);
    const minChunkY = this.chunkY(visible.minY);
    const maxChunkY = this.chunkY(visible.maxY);
    const startedAt = performance.now();
    let chunksDrawn = 0;
    let chunksRebuilt = 0;
    let drawnTiles = 0;
    const visibleKeys = new Set<string>();

    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        const key = `${chunkX},${chunkY}`;
        visibleKeys.add(key);
        let entry = this.cache.get(key);
        if (!entry) {
          entry = { canvas: this.acquireCanvas(), dirty: true, built: false };
          this.cache.set(key, entry);
        }

        // New chunks build immediately; dirty ones respect the frame budget.
        const mustBuild = !entry.built;
        if (entry.dirty && (mustBuild || performance.now() - startedAt < FRAME_BUDGET_MS.render)) {
          this.rebuild(entry.canvas, chunkX, chunkY);
          entry.dirty = false;
          entry.built = true;
          chunksRebuilt++;
        }

        const worldX = this.world.xMin + chunkX * CHUNK;
        const worldY = this.world.yMin + chunkY * CHUNK;
        const screen = camera.worldToScreen(worldX, worldY);
        const size = CHUNK * TILE.px * camera.zoom;
        ctx.drawImage(entry.canvas, screen.x, screen.y, size, size);
        chunksDrawn++;
      }
    }

    if (countTiles) {
      for (let y = visible.minY; y <= visible.maxY; y++) {
        for (let x = visible.minX; x <= visible.maxX; x++) {
          if (this.world.getTile(x, y) !== TileId.Air) drawnTiles++;
        }
      }
    }

    this.evict(visibleKeys);

    return {
      chunksVisible:
        Math.max(0, maxChunkX - minChunkX + 1) * Math.max(0, maxChunkY - minChunkY + 1),
      chunksDrawn,
      chunksRebuilt,
      drawnTiles,
    };
  }

  public clear(): void {
    for (const entry of this.cache.values()) this.pool.push(entry.canvas);
    this.cache.clear();
  }

  public dispose(): void {
    this.unsubscribe();
    this.clear();
    this.pool.length = 0;
  }

  private markDirty(x: number, y: number): void {
    const entry = this.cache.get(`${this.chunkX(x)},${this.chunkY(y)}`);
    if (entry) entry.dirty = true;
  }

  private evict(visibleKeys: Set<string>): void {
    if (this.cache.size <= RENDER.chunkCacheMax) return;
    for (const [key, entry] of this.cache) {
      if (this.cache.size <= RENDER.chunkCacheMax) break;
      if (visibleKeys.has(key)) continue;
      this.cache.delete(key);
      this.pool.push(entry.canvas);
    }
  }

  private acquireCanvas(): HTMLCanvasElement {
    const pooled = this.pool.pop();
    if (pooled) return pooled;
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK * TILE.px;
    canvas.height = CHUNK * TILE.px;
    return canvas;
  }

  private rebuild(canvas: HTMLCanvasElement, chunkX: number, chunkY: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('MyTerra: could not create a chunk canvas context.');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const worldX = this.world.xMin + chunkX * CHUNK;
    const worldY = this.world.yMin + chunkY * CHUNK;
    for (let localY = 0; localY < CHUNK; localY++) {
      for (let localX = 0; localX < CHUNK; localX++) {
        const wall = this.world.getWall(worldX + localX, worldY + localY);
        if (wall !== WallId.None) {
          ctx.fillStyle = wall === WallId.Dirt ? '#3e3027' : '#363d4a';
          ctx.fillRect(localX * TILE.px, localY * TILE.px, TILE.px, TILE.px);
        }
        const tile = this.world.getTile(worldX + localX, worldY + localY);
        if (tile === TileId.Air) continue;
        const source = this.atlas.sourceRect(tile);
        ctx.drawImage(
          this.atlas.canvas,
          source.sx,
          source.sy,
          source.sw,
          source.sh,
          localX * TILE.px,
          localY * TILE.px,
          TILE.px,
          TILE.px,
        );
      }
    }
  }

  private chunkX(x: number): number {
    return Math.floor((x - this.world.xMin) / CHUNK);
  }

  private chunkY(y: number): number {
    return Math.floor((y - this.world.yMin) / CHUNK);
  }
}
