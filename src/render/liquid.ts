import { LIQUID, TILE } from '../data/tuning';
import { liquidTypeFromByte, LiquidType } from '../world/world';
import type { World } from '../world/world';
import type { Camera } from './camera';

/** Draws each liquid cell as a translucent column with a waving surface. */
export class LiquidRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    world: World,
    timeSeconds: number,
  ): void {
    const view = camera.visibleRect();
    const scale = TILE.px * camera.zoom;
    ctx.imageSmoothingEnabled = false;

    for (let y = view.minY; y <= view.maxY; y++) {
      for (let x = view.minX; x <= view.maxX; x++) {
        const idx = world.idx(x, y);
        const amount = world.liquidAmount[idx] ?? 0;
        if (amount <= 0) continue;
        const type = liquidTypeFromByte(world.liquidType[idx] ?? 0);
        if (type === LiquidType.None) continue;

        const ratio = amount / LIQUID.amountMax;
        const height = Math.max(1, Math.round(scale * ratio));
        const screen = camera.worldToScreen(x, y);
        const above = liquidTypeFromByte(world.liquidType[world.idx(x, y - 1)] ?? 0);
        const surface = above !== type;

        const top = screen.y + scale - height;
        const wave = surface ? Math.sin(timeSeconds * 3 + x * 0.7) * scale * 0.06 : 0;

        ctx.fillStyle =
          type === LiquidType.Water ? 'rgba(58, 110, 190, 0.5)' : 'rgba(210, 80, 25, 0.82)';
        ctx.fillRect(screen.x, Math.round(top + wave), scale, height - Math.round(wave));

        if (surface) {
          ctx.fillStyle =
            type === LiquidType.Water ? 'rgba(150, 200, 240, 0.7)' : 'rgba(255, 170, 80, 0.85)';
          ctx.fillRect(
            screen.x,
            Math.round(top + wave),
            scale,
            Math.max(1, Math.round(scale * 0.08)),
          );
        }
      }
    }
  }
}
