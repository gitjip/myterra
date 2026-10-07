import { TILE } from '../data/tuning';
import { itemDefinition } from '../data/items';
import type { PickupManager } from '../entity/pickup';
import type { Camera } from './camera';
import { particleColor } from './particles';

/** Draws dropped items as small coloured squares. Art arrives later. */
export class PickupRenderer {
  public render(ctx: CanvasRenderingContext2D, camera: Camera, pickups: PickupManager): void {
    const scale = TILE.px * camera.zoom;
    for (const pickup of pickups.all) {
      if (!pickup.alive) continue;
      const screen = camera.worldToScreen(pickup.body.x, pickup.body.y);
      const size = Math.max(2, Math.round(pickup.body.w * scale));
      const tile = itemDefinition(pickup.item).tile;
      ctx.fillStyle = tile !== null ? particleColor(tile) : '#c9ccd6';
      ctx.fillRect(screen.x, screen.y, size, size);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, size - 1, size - 1);
    }
  }
}
