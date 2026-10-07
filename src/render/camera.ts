import { clamp } from '../core/math';
import { RENDER, TILE, WORLD } from '../data/tuning';
import type { World } from '../world/world';

export interface TileRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraPosition {
  readonly x: number;
  readonly y: number;
}

/** Tile-space camera with integer zoom and a bounded follow target. */
export class Camera {
  private readonly world: World;
  private viewportWidth: number = TILE.px;
  private viewportHeight: number = TILE.px;
  private zoomValue: number = RENDER.defaultZoom;
  private centerX = 0;
  private centerY = 0;

  public constructor(world: World, zoom: number = RENDER.defaultZoom) {
    this.world = world;
    this.zoomValue = this.clampZoom(zoom);
    this.centerX = world.reachWidth / 2;
    this.centerY = (WORLD.yReachMin + WORLD.yReachMax) / 2;
    this.clampToWorld();
  }

  public get zoom(): number {
    return this.zoomValue;
  }

  public get position(): CameraPosition {
    return { x: this.centerX, y: this.centerY };
  }

  public get viewportWorldWidth(): number {
    return this.viewportWidth / (TILE.px * this.zoomValue);
  }

  public get viewportWorldHeight(): number {
    return this.viewportHeight / (TILE.px * this.zoomValue);
  }

  public setViewport(widthPx: number, heightPx: number): void {
    this.viewportWidth = Math.max(1, Math.round(widthPx));
    this.viewportHeight = Math.max(1, Math.round(heightPx));
    this.clampToWorld();
  }

  public setZoom(zoom: number): void {
    this.zoomValue = this.clampZoom(zoom);
    this.clampToWorld();
  }

  public changeZoom(delta: number): void {
    this.setZoom(this.zoomValue + Math.sign(delta));
  }

  public setPosition(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.clampToWorld();
  }

  public move(dx: number, dy: number): void {
    this.setPosition(this.centerX + dx, this.centerY + dy);
  }

  /** Keeps a target inside a pixel dead zone and looks ahead in its direction. */
  public follow(targetX: number, targetY: number, directionX = 0, directionY = 0): void {
    const deadZoneX = RENDER.cameraDeadZone / TILE.px;
    const deadZoneY = RENDER.cameraDeadZone / TILE.px;
    const lookAhead = RENDER.cameraLookAhead / TILE.px;
    const desiredX = targetX + Math.sign(directionX) * lookAhead;
    const desiredY = targetY + Math.sign(directionY) * lookAhead;

    if (desiredX > this.centerX + deadZoneX) this.centerX = desiredX - deadZoneX;
    else if (desiredX < this.centerX - deadZoneX) this.centerX = desiredX + deadZoneX;
    if (desiredY > this.centerY + deadZoneY) this.centerY = desiredY - deadZoneY;
    else if (desiredY < this.centerY - deadZoneY) this.centerY = desiredY + deadZoneY;
    this.clampToWorld();
  }

  public visibleRect(): TileRect {
    const left = this.left;
    const top = this.top;
    const right = this.right;
    const bottom = this.bottom;
    const minX = Math.max(this.world.xMin, Math.floor(left));
    const maxX = Math.min(this.world.xMax, Math.ceil(right) - 1);
    const minY = Math.max(this.world.yMin, Math.floor(top));
    const maxY = Math.min(this.world.yMax, Math.ceil(bottom) - 1);
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(0, maxX - minX + 1),
      height: Math.max(0, maxY - minY + 1),
    };
  }

  public worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round((x - this.left) * TILE.px * this.zoomValue),
      y: Math.round((y - this.top) * TILE.px * this.zoomValue),
    };
  }

  public get left(): number {
    return this.centerX - this.viewportWorldWidth / 2;
  }

  public get right(): number {
    return this.centerX + this.viewportWorldWidth / 2;
  }

  public get top(): number {
    return this.centerY - this.viewportWorldHeight / 2;
  }

  public get bottom(): number {
    return this.centerY + this.viewportWorldHeight / 2;
  }

  private clampZoom(zoom: number): number {
    return clamp(Math.round(zoom), RENDER.minZoom, RENDER.maxZoom);
  }

  private clampToWorld(): void {
    const halfWidth = this.viewportWorldWidth / 2;
    const halfHeight = this.viewportWorldHeight / 2;
    const minX = 0 + halfWidth;
    const maxX = this.world.reachWidth - halfWidth;
    const minY = WORLD.yReachMin + halfHeight;
    const maxY = WORLD.yReachMax + 1 - halfHeight;
    this.centerX = this.clampCenter(this.centerX, minX, maxX);
    this.centerY = this.clampCenter(this.centerY, minY, maxY);
  }

  private clampCenter(value: number, min: number, max: number): number {
    return min > max ? (min + max) / 2 : clamp(value, min, max);
  }
}
