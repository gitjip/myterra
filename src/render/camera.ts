import { approach, clamp, clamp01, lerp } from '../core/math';
import { FRAME, RENDER, TILE, WORLD } from '../data/tuning';
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
  private prevCenterX = 0;
  private prevCenterY = 0;
  private renderAlpha = 1;
  /** Eased look-ahead offset in -1..1 per axis; retained when not moving. */
  private lookX = 0;
  private lookY = 0;
  private lookTargetX = 0;
  private lookTargetY = 0;
  /** Optional cap on how far chunks are drawn from the camera centre, tiles. */
  private renderRadius = Number.POSITIVE_INFINITY;

  public constructor(world: World, zoom: number = RENDER.defaultZoom) {
    this.world = world;
    this.zoomValue = this.clampZoom(zoom);
    this.centerX = world.reachWidth / 2;
    this.centerY = (WORLD.yReachMin + WORLD.yReachMax) / 2;
    this.clampToWorld();
    this.prevCenterX = this.centerX;
    this.prevCenterY = this.centerY;
  }

  /**
   * Render interpolation. Call {@link beginStep} once at the start of each
   * fixed step and {@link setRenderAlpha} once per rendered frame, so the
   * camera advances smoothly between simulation states instead of stuttering.
   */
  public beginStep(): void {
    this.prevCenterX = this.centerX;
    this.prevCenterY = this.centerY;
  }

  public setRenderAlpha(alpha: number): void {
    this.renderAlpha = clamp01(alpha);
  }

  /** Limits rendering to a square of this many tiles around the camera centre. */
  public setRenderRadius(tiles: number): void {
    this.renderRadius = Number.isFinite(tiles) ? Math.max(1, tiles) : Number.POSITIVE_INFINITY;
  }

  private get renderCenterX(): number {
    if (this.renderAlpha >= 1) return this.centerX;
    if (this.renderAlpha <= 0) return this.prevCenterX;
    return lerp(this.prevCenterX, this.centerX, this.renderAlpha);
  }

  private get renderCenterY(): number {
    if (this.renderAlpha >= 1) return this.centerY;
    if (this.renderAlpha <= 0) return this.prevCenterY;
    return lerp(this.prevCenterY, this.centerY, this.renderAlpha);
  }

  public get zoom(): number {
    return this.zoomValue;
  }

  public get position(): CameraPosition {
    return { x: this.renderCenterX, y: this.renderCenterY };
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

  /**
   * Keeps a target inside a pixel dead zone and looks ahead in its direction.
   *
   * The look direction is retained when the incoming direction is zero and is
   * eased rather than snapped, so coming to rest or crossing zero velocity
   * never jerks the camera backwards.
   */
  public follow(targetX: number, targetY: number, directionX = 0, directionY = 0): void {
    const deadZoneX = RENDER.cameraDeadZone / TILE.px;
    const deadZoneY = RENDER.cameraDeadZone / TILE.px;
    const lookAhead = RENDER.cameraLookAhead / TILE.px;

    if (directionX !== 0) this.lookTargetX = directionX > 0 ? 1 : -1;
    if (directionY !== 0) this.lookTargetY = directionY > 0 ? 1 : -1;
    const ease = RENDER.cameraLookEase * FRAME.fixedDt;
    this.lookX = approach(this.lookX, this.lookTargetX, ease);
    this.lookY = approach(this.lookY, this.lookTargetY, ease);

    const desiredX = targetX + this.lookX * lookAhead;
    const desiredY = targetY + this.lookY * lookAhead;

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
    let minX = Math.max(this.world.xMin, Math.floor(left));
    let maxX = Math.min(this.world.xMax, Math.ceil(right) - 1);
    let minY = Math.max(this.world.yMin, Math.floor(top));
    let maxY = Math.min(this.world.yMax, Math.ceil(bottom) - 1);
    if (Number.isFinite(this.renderRadius)) {
      const cx = this.renderCenterX;
      const cy = this.renderCenterY;
      minX = Math.max(minX, Math.floor(cx - this.renderRadius));
      maxX = Math.min(maxX, Math.ceil(cx + this.renderRadius) - 1);
      minY = Math.max(minY, Math.floor(cy - this.renderRadius));
      maxY = Math.min(maxY, Math.ceil(cy + this.renderRadius) - 1);
    }
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
    return this.renderCenterX - this.viewportWorldWidth / 2;
  }

  public get right(): number {
    return this.renderCenterX + this.viewportWorldWidth / 2;
  }

  public get top(): number {
    return this.renderCenterY - this.viewportWorldHeight / 2;
  }

  public get bottom(): number {
    return this.renderCenterY + this.viewportWorldHeight / 2;
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
    this.prevCenterX = this.clampCenter(this.prevCenterX, minX, maxX);
    this.prevCenterY = this.clampCenter(this.prevCenterY, minY, maxY);
  }

  private clampCenter(value: number, min: number, max: number): number {
    return min > max ? (min + max) / 2 : clamp(value, min, max);
  }
}
