import { TILE } from '../data/tuning';
import { CHUNK } from '../world/constants';
import type { World } from '../world/world';
import type { Camera } from '../render/camera';
import type { Body } from '../systems/physics';

/** Minimal frame data the visualisers read; built by the game each render. */
export interface VizFrame {
  readonly world: World;
  readonly camera: Camera;
  readonly playerBody: Body;
  readonly enemies: readonly { readonly body: Body; readonly alive: boolean }[];
  readonly passives: readonly { readonly body: Body; readonly alive: boolean }[];
  readonly pickups: readonly { readonly body: Body }[];
  readonly projectiles: readonly { readonly body: Body }[];
  readonly aim: { readonly x: number; readonly y: number } | null;
}

interface Layer {
  readonly id: string;
  readonly label: string;
  readonly render: (ctx: CanvasRenderingContext2D, frame: VizFrame) => void;
}

const LAYERS: Layer[] = [
  {
    id: 'sky',
    label: 'sky light heatmap',
    render: (ctx, frame) => {
      forEachVisible(frame, (x, y) => {
        const depth = frame.world.skyDepth[frame.world.idx(x, y)] ?? 255;
        const alpha = ((255 - depth) / 255) * 0.55;
        if (alpha <= 0.01) return;
        fillTile(ctx, frame.camera, x, y, `rgba(70, 130, 255, ${alpha.toFixed(3)})`);
      });
    },
  },
  {
    id: 'block',
    label: 'block light heatmap',
    render: (ctx, frame) => {
      forEachVisible(frame, (x, y) => {
        const level = frame.world.blockLight[frame.world.idx(x, y)] ?? 0;
        const alpha = (level / 255) * 0.6;
        if (alpha <= 0.01) return;
        fillTile(ctx, frame.camera, x, y, `rgba(255, 180, 60, ${alpha.toFixed(3)})`);
      });
    },
  },
  {
    id: 'chunks',
    label: 'chunk boundaries',
    render: (ctx, frame) => {
      const view = frame.camera.visibleRect();
      const scale = TILE.px * frame.camera.zoom;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(120, 220, 160, 0.5)';
      const firstX = frame.world.xMin + Math.floor((view.minX - frame.world.xMin) / CHUNK) * CHUNK;
      const firstY = frame.world.yMin + Math.floor((view.minY - frame.world.yMin) / CHUNK) * CHUNK;
      for (let x = firstX; x <= view.maxX + CHUNK; x += CHUNK) {
        const screen = frame.camera.worldToScreen(x, view.minY);
        ctx.beginPath();
        ctx.moveTo(screen.x + 0.5, 0);
        ctx.lineTo(screen.x + 0.5, view.height * scale);
        ctx.stroke();
      }
      for (let y = firstY; y <= view.maxY + CHUNK; y += CHUNK) {
        const screen = frame.camera.worldToScreen(view.minX, y);
        ctx.beginPath();
        ctx.moveTo(0, screen.y + 0.5);
        ctx.lineTo(view.width * scale, screen.y + 0.5);
        ctx.stroke();
      }
    },
  },
  {
    id: 'boxes',
    label: 'entity and reach boxes',
    render: (ctx, frame) => {
      strokeBox(ctx, frame.camera, frame.playerBody, 'rgba(255, 255, 255, 0.8)');
      for (const enemy of frame.enemies) {
        if (enemy.alive) strokeBox(ctx, frame.camera, enemy.body, 'rgba(255, 90, 90, 0.9)');
      }
      for (const passive of frame.passives) {
        if (passive.alive) strokeBox(ctx, frame.camera, passive.body, 'rgba(120, 220, 255, 0.9)');
      }
      for (const drop of frame.pickups) strokeBox(ctx, frame.camera, drop.body, 'rgba(240, 213, 140, 0.9)');
      for (const projectile of frame.projectiles) {
        strokeBox(ctx, frame.camera, projectile.body, 'rgba(255, 255, 0, 0.9)');
      }
      const body = frame.playerBody;
      const reach = 5;
      const min = frame.camera.worldToScreen(body.x - reach, body.y - reach);
      const scale = TILE.px * frame.camera.zoom;
      const size = (body.w + reach * 2) * scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.strokeRect(min.x + 0.5, min.y + 0.5, size, (body.h + reach * 2) * scale);
      if (frame.aim) {
        const screen = frame.camera.worldToScreen(frame.aim.x, frame.aim.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, scale, scale);
      }
    },
  },
];

function forEachVisible(frame: VizFrame, fn: (x: number, y: number) => void): void {
  const view = frame.camera.visibleRect();
  for (let y = view.minY; y <= view.maxY; y++) {
    for (let x = view.minX; x <= view.maxX; x++) fn(x, y);
  }
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  x: number,
  y: number,
  color: string,
): void {
  const screen = camera.worldToScreen(x, y);
  const size = TILE.px * camera.zoom;
  ctx.fillStyle = color;
  ctx.fillRect(screen.x, screen.y, size, size);
}

function strokeBox(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  body: Body,
  color: string,
): void {
  const screen = camera.worldToScreen(body.x, body.y);
  const scale = TILE.px * camera.zoom;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, body.w * scale, body.h * scale);
}

export interface DevLayers {
  render(ctx: CanvasRenderingContext2D, frame: VizFrame): void;
  set(id: string, on: boolean): boolean;
  list(): string;
}

/** Creates the overlay visualisers. Only loaded in Dev. */
export function createDevLayers(): DevLayers {
  const enabled = new Set<string>();
  const byId = new Map(LAYERS.map((layer) => [layer.id, layer]));
  return {
    render: (ctx, frame) => {
      for (const layer of LAYERS) {
        if (!enabled.has(layer.id)) continue;
        ctx.save();
        layer.render(ctx, frame);
        ctx.restore();
      }
    },
    set: (id, on) => {
      if (!byId.has(id)) return false;
      if (on) enabled.add(id);
      else enabled.delete(id);
      return true;
    },
    list: () =>
      LAYERS.map((layer) => `${enabled.has(layer.id) ? '[x]' : '[ ]'} ${layer.id.padEnd(8)} ${layer.label}`).join(
        '\n',
      ),
  };
}
