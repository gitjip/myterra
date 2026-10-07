import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/data/tuning';
import { Camera } from '../src/render/camera';
import { World } from '../src/world/world';

function camera(): Camera {
  const result = new Camera(new World({ reachWidth: WORLD.minReachWidth }));
  result.setViewport(320, 160);
  return result;
}

describe('Camera', () => {
  it('uses integer zoom and clamps it to the configured range', () => {
    const result = camera();
    result.setZoom(99.4);
    expect(result.zoom).toBe(6);
    result.setZoom(0.4);
    expect(result.zoom).toBe(1);
    result.setZoom(3.6);
    expect(result.zoom).toBe(4);
  });

  it('clamps the viewport inside the reachable world range', () => {
    const result = camera();
    result.setPosition(-1000, -1000);
    const topLeft = result.visibleRect();
    expect(topLeft.minX).toBe(0);
    expect(topLeft.minY).toBe(WORLD.yReachMin);

    result.setPosition(1000, 1000);
    const bottomRight = result.visibleRect();
    expect(bottomRight.maxX).toBeLessThan(WORLD.minReachWidth);
    expect(bottomRight.maxY).toBe(WORLD.yReachMax);
  });

  it('reports visible tile counts and integer screen positions', () => {
    const result = camera();
    result.setPosition(100, 10);
    const visible = result.visibleRect();
    expect(visible.width).toBeGreaterThan(0);
    expect(visible.height).toBeGreaterThan(0);
    expect(visible.width * visible.height).toBeGreaterThan(0);
    const screen = result.worldToScreen(100, 10);
    expect(Number.isInteger(screen.x)).toBe(true);
    expect(Number.isInteger(screen.y)).toBe(true);
  });

  it('follows a distant target while respecting the dead zone and bounds', () => {
    const result = camera();
    result.setPosition(100, 10);
    const before = result.position;
    result.follow(200, 100, 1, 1);
    const after = result.position;
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
    result.follow(-1000, -1000, -1, -1);
    expect(result.visibleRect().minX).toBe(0);
    expect(result.visibleRect().minY).toBe(WORLD.yReachMin);
  });
});
