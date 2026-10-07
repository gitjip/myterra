import { clamp } from '../core/math';
import { LIQUID, WORLD } from '../data/tuning';
import { TileId, tileDefinition, tileIdFromByte, wallIdFromByte, WallId } from '../data/tiles';
import { Y_MAX, Y_MIN, WORLD_HEIGHT, worldXMax, worldXMin, totalWorldWidth } from './constants';
import type { WorldSize } from './constants';

export enum LiquidType {
  None = 0,
  Water = 1,
  Lava = 2,
}

export function liquidTypeFromByte(value: number): LiquidType {
  switch (value) {
    case 1:
      return LiquidType.Water;
    case 2:
      return LiquidType.Lava;
    default:
      return LiquidType.None;
  }
}

export interface WorldBounds {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** The complete resident tile grid. Coordinates include a negative left buffer. */
export class World {
  public readonly reachWidth: number;
  public readonly width: number;
  public readonly height = WORLD_HEIGHT;
  public readonly xMin: number;
  public readonly xMax: number;
  public readonly yMin = Y_MIN;
  public readonly yMax = Y_MAX;

  public readonly fg: Uint8Array;
  public readonly wall: Uint8Array;
  public readonly skyDepth: Uint8Array;
  public readonly blockLight: Uint8Array;
  public readonly liquidType: Uint8Array;
  public readonly liquidAmount: Uint8Array;
  /** Save diff bitmaps: one bit per cell, set by gameplay edits only. */
  public readonly tileDirty: Uint8Array;
  public readonly liquidDirty: Uint8Array;

  private revisionValue = 0;

  public constructor(size: WorldSize) {
    if (
      !Number.isInteger(size.reachWidth) ||
      size.reachWidth < WORLD.minReachWidth ||
      size.reachWidth > WORLD.maxReachWidth
    ) {
      throw new RangeError(
        `World reach width must be an integer in ${WORLD.minReachWidth}..${WORLD.maxReachWidth}`,
      );
    }

    this.reachWidth = size.reachWidth;
    this.width = totalWorldWidth(size.reachWidth);
    this.xMin = worldXMin();
    this.xMax = worldXMax(size.reachWidth);
    const cells = this.width * this.height;
    this.fg = new Uint8Array(cells);
    this.wall = new Uint8Array(cells);
    this.skyDepth = new Uint8Array(cells);
    this.blockLight = new Uint8Array(cells);
    this.liquidType = new Uint8Array(cells);
    this.liquidAmount = new Uint8Array(cells);
    const bytes = (cells + 7) >> 3;
    this.tileDirty = new Uint8Array(bytes);
    this.liquidDirty = new Uint8Array(bytes);
  }

  /** Monotonic revision used by render caches. */
  public get revision(): number {
    return this.revisionValue;
  }

  public get bounds(): WorldBounds {
    return { xMin: this.xMin, xMax: this.xMax, yMin: this.yMin, yMax: this.yMax };
  }

  /** Returns a clamped linear index; callers never need a second boundary branch. */
  public idx(x: number, y: number): number {
    const safeX = clamp(Math.trunc(x), this.xMin, this.xMax);
    const safeY = clamp(Math.trunc(y), this.yMin, this.yMax);
    return (safeY - this.yMin) * this.width + (safeX - this.xMin);
  }

  public inReach(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < this.reachWidth &&
      y >= WORLD.yReachMin &&
      y <= WORLD.yReachMax
    );
  }

  public getTile(x: number, y: number): TileId {
    return tileIdFromByte(this.fg[this.idx(x, y)] ?? TileId.Air);
  }

  public setTile(x: number, y: number, tile: TileId): void {
    const index = this.idx(x, y);
    if (this.fg[index] === tile) return;
    this.fg[index] = tile;
    if (tileDefinition(tile).solid) {
      this.liquidType[index] = LiquidType.None;
      this.liquidAmount[index] = 0;
      markBit(this.liquidDirty, index);
    }
    markBit(this.tileDirty, index);
    this.markDirtyIndex(index);
  }

  public getWall(x: number, y: number): WallId {
    return wallIdFromByte(this.wall[this.idx(x, y)] ?? WallId.None);
  }

  public setWall(x: number, y: number, wall: WallId): void {
    const index = this.idx(x, y);
    if (this.wall[index] === wall) return;
    this.wall[index] = wall;
    this.markDirtyIndex(index);
  }

  public isSolid(x: number, y: number): boolean {
    return tileDefinition(this.getTile(x, y)).solid;
  }

  public isPassable(x: number, y: number): boolean {
    return tileDefinition(this.getTile(x, y)).passable;
  }

  public liquidAt(x: number, y: number): { type: LiquidType; amount: number } {
    const index = this.idx(x, y);
    return {
      type:
        this.liquidType[index] === LiquidType.Water
          ? LiquidType.Water
          : this.liquidType[index] === LiquidType.Lava
            ? LiquidType.Lava
            : LiquidType.None,
      amount: this.liquidAmount[index] ?? 0,
    };
  }

  public setLiquid(x: number, y: number, type: LiquidType, amount: number): void {
    const index = this.idx(x, y);
    const safeAmount = clamp(Math.trunc(amount), 0, LIQUID.amountMax);
    const safeType = safeAmount === 0 ? LiquidType.None : type;
    if (this.liquidType[index] === safeType && this.liquidAmount[index] === safeAmount) return;
    this.liquidType[index] = safeType;
    this.liquidAmount[index] = safeAmount;
    markBit(this.liquidDirty, index);
    this.markDirtyIndex(index);
  }

  public markDirty(x: number, y: number): void {
    const index = this.idx(x, y);
    markBit(this.tileDirty, index);
    markBit(this.liquidDirty, index);
    this.markDirtyIndex(index);
  }

  public isTileDirty(index: number): boolean {
    return ((this.tileDirty[index >> 3] ?? 0) & (1 << (index & 7))) !== 0;
  }

  public isLiquidDirty(index: number): boolean {
    return ((this.liquidDirty[index >> 3] ?? 0) & (1 << (index & 7))) !== 0;
  }

  /** Resets the save diff after generation or a successful save. */
  public clearDirty(): void {
    this.tileDirty.fill(0);
    this.liquidDirty.fill(0);
  }

  /** Bumps the render revision after a bulk, out-of-band write (generation). */
  public bumpRevision(): void {
    this.revisionValue++;
  }

  private markDirtyIndex(_index: number): void {
    this.revisionValue++;
  }
}

function markBit(bits: Uint8Array, index: number): void {
  const byte = index >> 3;
  bits[byte] = (bits[byte] ?? 0) | (1 << (index & 7));
}
