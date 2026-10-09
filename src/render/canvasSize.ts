import { RENDER } from '../data/tuning';

/**
 * Sets the canvas backing store to the fixed logical resolution and scales its
 * CSS box by the largest integer factor that fits the window. Keeps rendering
 * pixel-exact and independent of window size and device pixel ratio.
 */
export function sizeCanvasToWindow(canvas: HTMLCanvasElement): void {
  const width = RENDER.logicalWidth;
  const height = RENDER.logicalHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const factor = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / width, window.innerHeight / height)),
  );
  canvas.style.width = `${width * factor}px`;
  canvas.style.height = `${height * factor}px`;
}
