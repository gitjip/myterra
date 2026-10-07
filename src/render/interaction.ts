import { TILE } from '../data/tuning';
import type { Camera } from './camera';

export interface TileTarget {
  readonly x: number;
  readonly y: number;
}

/** Highlights the aimed tile and shades it while mining is in progress. */
export class InteractionRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    target: TileTarget | null,
    miningProgress: number,
  ): void {
    if (!target) return;
    const screen = camera.worldToScreen(target.x, target.y);
    const size = TILE.px * camera.zoom;

    if (miningProgress > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(miningProgress * 0.5).toFixed(3)})`;
      ctx.fillRect(screen.x, screen.y, size, size);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, size - 1, size - 1);
  }
}
