import { TILE } from '../data/tuning';
import { displayBrightness } from '../world/light';
import type { World } from '../world/world';
import type { Camera } from './camera';

/**
 * Full-screen light pass. It bakes one pixel per visible tile into a small
 * ImageData, then scales it up and multiplies it over the scene, so even hard
 * edges cost a single drawImage.
 */
export class LightOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private image: ImageData | null = null;
  private width = 0;
  private height = 0;

  public constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('MyTerra: could not create the light overlay context.');
    this.ctx = ctx;
  }

  public render(
    target: CanvasRenderingContext2D,
    camera: Camera,
    world: World,
    dayFactor: number,
  ): void {
    const view = camera.visibleRect();
    const minX = Math.max(world.xMin, view.minX);
    const maxX = Math.min(world.xMax, view.maxX);
    const minY = Math.max(world.yMin, view.minY);
    const maxY = Math.min(world.yMax, view.maxY);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w <= 0 || h <= 0) return;

    if (w !== this.width || h !== this.height || !this.image) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.width = w;
      this.height = h;
      this.image = this.ctx.createImageData(w, h);
    }

    const data = this.image.data;
    for (let ty = 0; ty < h; ty++) {
      const y = minY + ty;
      for (let tx = 0; tx < w; tx++) {
        const brightness = displayBrightness(world, minX + tx, y, dayFactor);
        const value = brightness < 0 ? 0 : brightness > 255 ? 255 : brightness | 0;
        const p = (ty * w + tx) * 4;
        data[p] = value;
        data[p + 1] = value;
        data[p + 2] = value;
        data[p + 3] = 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);

    const screen = camera.worldToScreen(minX, minY);
    const scale = TILE.px * camera.zoom;
    target.imageSmoothingEnabled = false;
    target.globalCompositeOperation = 'multiply';
    target.drawImage(this.canvas, screen.x, screen.y, w * scale, h * scale);
    target.globalCompositeOperation = 'source-over';
  }
}
