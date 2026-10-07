import { TILE } from '../data/tuning';
import type { Player } from '../entity/player';
import type { Camera } from './camera';

/**
 * Placeholder player rendering. Art is a later milestone, so this is a flat
 * capsule plus, when the debug overlay is on, the collision box the spec
 * requires to be visible in F3.
 */
export class PlayerRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: Player,
    debug: boolean,
  ): void {
    const screen = camera.worldToScreen(player.body.x, player.body.y);
    const scale = TILE.px * camera.zoom;
    const w = Math.max(1, Math.round(player.body.w * scale));
    const h = Math.max(1, Math.round(player.body.h * scale));

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#e0b083';
    ctx.fillRect(screen.x, screen.y, w, h);

    ctx.fillStyle = '#3b2b20';
    ctx.fillRect(screen.x, screen.y, w, Math.max(2, Math.round(h * 0.22)));

    const eyeSize = Math.max(2, Math.round(scale * 0.14));
    const eyeX = player.facing > 0 ? screen.x + w - eyeSize * 2 : screen.x + eyeSize;
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(eyeX, screen.y + Math.round(h * 0.1), eyeSize, eyeSize);

    if (debug) {
      ctx.strokeStyle = '#ff5f5f';
      ctx.lineWidth = 1;
      ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, w - 1, h - 1);
    }
  }
}
