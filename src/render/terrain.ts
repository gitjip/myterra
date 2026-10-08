import { FRAME_BUDGET_MS } from '../data/tuning';
import type { World } from '../world/world';
import type { Camera, TileRect } from './camera';
import { ChunkRenderer } from './chunks';
import type { ChunkRenderStats } from './chunks';
import { TileAtlas } from './atlas';

export interface TerrainRenderStats extends ChunkRenderStats {
  readonly visibleRect: TileRect;
  readonly visibleTileCount: number;
}

/** M1 terrain pass: sky fill plus cached foreground chunks. */
export class TerrainRenderer {
  public readonly atlas: TileAtlas;
  public readonly chunks: ChunkRenderer;

  public constructor(world: World) {
    this.atlas = new TileAtlas();
    this.chunks = new ChunkRenderer(world, this.atlas);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    skyColor: string,
  ): TerrainRenderStats {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const stats = this.chunks.render(ctx, camera);
    const visibleRect = camera.visibleRect();
    return {
      ...stats,
      visibleRect,
      visibleTileCount: visibleRect.width * visibleRect.height,
    };
  }

  public get renderBudgetMs(): number {
    return FRAME_BUDGET_MS.render;
  }

  public dispose(): void {
    this.chunks.dispose();
  }
}
