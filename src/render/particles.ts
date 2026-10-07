import { PARTICLE } from '../data/tuning';
import { TileId } from '../data/tiles';
import type { Camera } from './camera';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
}

const TILE_COLORS: Readonly<Partial<Record<TileId, string>>> = {
  [TileId.Dirt]: '#76502f',
  [TileId.Stone]: '#606875',
  [TileId.Grass]: '#59a34f',
  [TileId.Wood]: '#85512d',
  [TileId.Leaf]: '#4da96b',
  [TileId.Sand]: '#d0ad66',
  [TileId.Torch]: '#ffd166',
  [TileId.DoorTopClosed]: '#8a5a32',
  [TileId.DoorBottomClosed]: '#8a5a32',
};

export function particleColor(tile: TileId): string {
  return TILE_COLORS[tile] ?? '#9aa0ad';
}

/** Pooled mining-debris particles. Presentation only, never simulated. */
export class ParticleSystem {
  private readonly pool: Particle[] = [];

  public constructor() {
    for (let i = 0; i < PARTICLE.maxCount; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        color: '#fff',
        active: false,
      });
    }
  }

  public get activeCount(): number {
    let total = 0;
    for (const particle of this.pool) if (particle.active) total++;
    return total;
  }

  public spawnBurst(x: number, y: number, color: string, count = PARTICLE.perBreak): void {
    let spawned = 0;
    for (const particle of this.pool) {
      if (particle.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = PARTICLE.speed * (0.4 + Math.random() * 0.6);
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - PARTICLE.speed * 0.5;
      particle.maxLife = PARTICLE.lifetimeSeconds * (0.6 + Math.random() * 0.4);
      particle.life = particle.maxLife;
      particle.color = color;
      particle.active = true;
      if (++spawned >= count) break;
    }
  }

  public update(dt: number): void {
    for (const particle of this.pool) {
      if (!particle.active) continue;
      particle.vy += PARTICLE.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      if (particle.life <= 0) particle.active = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const size = Math.max(1, Math.round(PARTICLE.size * camera.zoom));
    for (const particle of this.pool) {
      if (!particle.active) continue;
      const screen = camera.worldToScreen(particle.x, particle.y);
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(screen.x, screen.y, size, size);
    }
    ctx.globalAlpha = 1;
  }
}
