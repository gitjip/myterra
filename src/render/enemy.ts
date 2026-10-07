import type { Enemy } from '../entity/enemy';
import type { Camera } from './camera';

/** Placeholder enemy rendering: a coloured box; flashes white when hit. */
export class EnemyRenderer {
  public render(ctx: CanvasRenderingContext2D, camera: Camera, enemies: readonly Enemy[]): void {
    const scale = 16 * camera.zoom;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const screen = camera.worldToScreen(enemy.body.x, enemy.body.y);
      const w = Math.max(1, Math.round(enemy.body.w * scale));
      const h = Math.max(1, Math.round(enemy.body.h * scale));
      ctx.fillStyle = enemy.def.color;
      ctx.fillRect(screen.x, screen.y, w, h);
      const eye = Math.max(2, Math.round(scale * 0.12));
      ctx.fillStyle = '#101018';
      ctx.fillRect(
        enemy.facing > 0 ? screen.x + w - eye * 2 : screen.x + eye,
        screen.y + Math.round(h * 0.18),
        eye,
        eye,
      );
      if (enemy.flash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(screen.x, screen.y, w, h);
      }
    }
  }
}

/** Floating damage numbers, object-pooled. */
export class DamageNumbers {
  private readonly pool: Array<{
    x: number;
    y: number;
    value: number;
    life: number;
    maxLife: number;
    active: boolean;
  }> = [];
  private readonly max = 64;

  public constructor() {
    for (let i = 0; i < this.max; i++) {
      this.pool.push({ x: 0, y: 0, value: 0, life: 0, maxLife: 0, active: false });
    }
  }

  public spawn(x: number, y: number, value: number): void {
    for (const item of this.pool) {
      if (item.active) continue;
      item.x = x;
      item.y = y;
      item.value = value;
      item.maxLife = 0.7;
      item.life = item.maxLife;
      item.active = true;
      return;
    }
  }

  public update(dt: number): void {
    for (const item of this.pool) {
      if (!item.active) continue;
      item.y -= 1.5 * dt;
      item.life -= dt;
      if (item.life <= 0) item.active = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const scale = 16 * camera.zoom;
    ctx.font = `${Math.max(10, Math.round(scale * 0.5))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    for (const item of this.pool) {
      if (!item.active) continue;
      const screen = camera.worldToScreen(item.x, item.y);
      ctx.globalAlpha = Math.max(0, item.life / item.maxLife);
      ctx.fillStyle = '#ffd7d7';
      ctx.fillText(String(Math.round(item.value)), screen.x, screen.y);
    }
    ctx.globalAlpha = 1;
  }
}
