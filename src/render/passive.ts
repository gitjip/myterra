import type { Passive } from '../entity/passive';
import type { Camera } from './camera';

/** Placeholder passive rendering: a small coloured box. */
export class PassiveRenderer {
  public render(ctx: CanvasRenderingContext2D, camera: Camera, rabbits: readonly Passive[]): void {
    const scale = 16 * camera.zoom;
    for (const rabbit of rabbits) {
      if (!rabbit.alive) continue;
      const screen = camera.worldToScreen(rabbit.body.x, rabbit.body.y);
      const w = Math.max(1, Math.round(rabbit.body.w * scale));
      const h = Math.max(1, Math.round(rabbit.body.h * scale));
      ctx.fillStyle = rabbit.def.color;
      ctx.fillRect(screen.x, screen.y, w, h);
      const ear = Math.max(1, Math.round(scale * 0.1));
      ctx.fillStyle = '#b8b2a4';
      ctx.fillRect(screen.x, screen.y - ear, w, ear);
    }
  }
}
