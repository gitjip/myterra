import { LIQUID } from '../data/tuning';
import { tileDefinition, tileIdFromByte, TileId } from '../data/tiles';
import { liquidTypeFromByte, LiquidType } from './world';
import type { World } from './world';

/**
 * Finite-volume liquid cellular automaton. Cells flow down, then diagonally,
 * then horizontally by level difference. Only active cells are visited; the
 * queue drains to empty once everything has settled.
 */
export class LiquidSystem {
  private queue = new Int32Array(1024);
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly queued: Uint8Array;

  public constructor(private readonly world: World) {
    this.queued = new Uint8Array((world.width * world.height + 7) >> 3);
  }

  public get activeCells(): number {
    return this.count;
  }

  public wake(x: number, y: number): void {
    this.wakeIndex(this.world.idx(x, y));
  }

  /** Wakes a cell and its four neighbours, used after a tile edit. */
  public wakeNeighbourhood(x: number, y: number): void {
    this.wake(x, y);
    this.wake(x - 1, y);
    this.wake(x + 1, y);
    this.wake(x, y - 1);
    this.wake(x, y + 1);
  }

  /** Enqueues every non-empty liquid cell. Used after loading a save. */
  public rebuildActive(): void {
    this.reset();
    const amounts = this.world.liquidAmount;
    for (let i = 0; i < amounts.length; i++) {
      if ((amounts[i] ?? 0) > 0) this.wakeIndex(i);
    }
  }

  public clear(): void {
    this.reset();
  }

  public update(budgetMs: number): void {
    const started = performance.now();
    let processed = 0;
    while (
      this.count > 0 &&
      processed < LIQUID.maxCellsPerTick &&
      performance.now() - started < budgetMs
    ) {
      const index = this.queue[this.head] ?? 0;
      this.head = (this.head + 1) % this.queue.length;
      this.count--;
      this.clearQueued(index);
      processed++;
      this.process(index);
    }
    if (this.count === 0) {
      this.head = 0;
      this.tail = 0;
    }
  }

  // -------------------------------------------------------------------------

  private process(index: number): void {
    const amount = this.world.liquidAmount[index] ?? 0;
    if (amount <= 0) {
      if (liquidTypeFromByte(this.world.liquidType[index] ?? 0) !== LiquidType.None) {
        this.setAmount(index, LiquidType.None, 0);
      }
      return;
    }
    const type = liquidTypeFromByte(this.world.liquidType[index] ?? 0);
    if (type === LiquidType.None) return;
    if (this.react(index, type)) return;

    const { width, xMin, yMin, yMax } = this.world;
    const col = index % width;
    const row = (index - col) / width;
    const x = xMin + col;
    const y = yMin + row;

    let remaining = amount;

    // Down.
    if (y < yMax) {
      const below = index + width;
      const room = this.roomFor(below, type);
      if (room > 0) {
        const move = Math.min(remaining, room, LIQUID.maxTransferPerStep);
        this.transfer(index, below, type, move);
        remaining -= move;
      }
    }

    // Diagonals (only past a non-solid side).
    const firstDx = x % 2 === 0 ? -1 : 1;
    const secondDx = -firstDx;
    if (remaining > 0) {
      remaining = this.tryDiagonal(index, x, y, firstDx, type, remaining);
    }
    if (remaining > 0) {
      remaining = this.tryDiagonal(index, x, y, secondDx, type, remaining);
    }

    // Horizontal equalisation.
    if (remaining > 0) {
      remaining = this.tryHorizontal(index, x, firstDx, type, remaining);
    }
    if (remaining > 0) {
      this.tryHorizontal(index, x, secondDx, type, remaining);
    }
  }

  private tryDiagonal(
    index: number,
    x: number,
    y: number,
    dx: number,
    type: LiquidType,
    remaining: number,
  ): number {
    const { width, xMin, xMax, yMax } = this.world;
    const nx = x + dx;
    if (nx < xMin || nx > xMax || y >= yMax) return remaining;
    if (this.isSolid(index + dx)) return remaining;
    const diagonal = index + dx + width;
    const room = this.roomFor(diagonal, type);
    if (room <= 0) return remaining;
    const move = Math.min(remaining, room, LIQUID.maxTransferPerStep);
    this.transfer(index, diagonal, type, move);
    return remaining - move;
  }

  private tryHorizontal(
    index: number,
    x: number,
    dx: number,
    type: LiquidType,
    remaining: number,
  ): number {
    const { xMin, xMax } = this.world;
    const nx = x + dx;
    if (nx < xMin || nx > xMax) return remaining;
    const side = index + dx;
    if (this.isSolid(side)) return remaining;
    const sideType = liquidTypeFromByte(this.world.liquidType[side] ?? 0);
    if (sideType !== LiquidType.None && sideType !== type) return remaining;
    const target = this.world.liquidAmount[side] ?? 0;
    const difference = remaining - target;
    if (difference < LIQUID.restThreshold) return remaining;
    const room = LIQUID.amountMax - target;
    const move = Math.min(remaining, room, LIQUID.maxTransferPerStep, difference >> 1);
    if (move <= 0) return remaining;
    this.transfer(index, side, type, move);
    return remaining - move;
  }

  private react(index: number, type: LiquidType): boolean {
    const { width, xMin, xMax, yMin, yMax } = this.world;
    const col = index % width;
    const row = (index - col) / width;
    const x = xMin + col;
    const y = yMin + row;
    if (x > xMin && this.tryReact(index, index - 1, type)) return true;
    if (x < xMax && this.tryReact(index, index + 1, type)) return true;
    if (y > yMin && this.tryReact(index, index - width, type)) return true;
    if (y < yMax && this.tryReact(index, index + width, type)) return true;
    return false;
  }

  private tryReact(self: number, other: number, type: LiquidType): boolean {
    const otherType = liquidTypeFromByte(this.world.liquidType[other] ?? 0);
    const otherAmount = this.world.liquidAmount[other] ?? 0;
    if (otherAmount <= 0 || otherType === LiquidType.None || otherType === type) return false;

    const { width, xMin, yMin } = this.world;
    const selfCol = self % width;
    const selfX = xMin + selfCol;
    const selfY = yMin + (self - selfCol) / width;
    const otherCol = other % width;
    const otherX = xMin + otherCol;
    const otherY = yMin + (other - otherCol) / width;

    if (type === LiquidType.Water) {
      this.world.setTile(otherX, otherY, TileId.Obsidian);
      this.world.setTile(selfX, selfY, TileId.Stone);
    } else {
      this.world.setTile(selfX, selfY, TileId.Obsidian);
      this.world.setTile(otherX, otherY, TileId.Stone);
    }
    this.wakeAround(self);
    this.wakeAround(other);
    return true;
  }

  private roomFor(index: number, type: LiquidType): number {
    if (this.isSolid(index)) return 0;
    const targetType = liquidTypeFromByte(this.world.liquidType[index] ?? 0);
    const targetAmount = this.world.liquidAmount[index] ?? 0;
    if (targetAmount === 0) return LIQUID.amountMax;
    if (targetType === type) return LIQUID.amountMax - targetAmount;
    return 0;
  }

  private isSolid(index: number): boolean {
    return tileDefinition(tileIdFromByte(this.world.fg[index] ?? 0)).solid;
  }

  private transfer(from: number, to: number, type: LiquidType, amount: number): void {
    const fromAmount = this.world.liquidAmount[from] ?? 0;
    const toAmount = this.world.liquidAmount[to] ?? 0;
    this.setAmount(from, fromAmount - amount > 0 ? type : LiquidType.None, fromAmount - amount);
    this.setAmount(to, type, toAmount + amount);
    this.wakeAround(from);
    this.wakeAround(to);
  }

  private setAmount(index: number, type: LiquidType, amount: number): void {
    const width = this.world.width;
    const col = index % width;
    const x = this.world.xMin + col;
    const y = this.world.yMin + (index - col) / width;
    this.world.setLiquid(x, y, type, amount);
  }

  private wakeAround(index: number): void {
    const { width, xMin, xMax, yMin, yMax } = this.world;
    const col = index % width;
    const row = (index - col) / width;
    const x = xMin + col;
    const y = yMin + row;
    this.wakeIndex(index);
    if (x > xMin) this.wakeIndex(index - 1);
    if (x < xMax) this.wakeIndex(index + 1);
    if (y > yMin) this.wakeIndex(index - width);
    if (y < yMax) this.wakeIndex(index + width);
  }

  private wakeIndex(index: number): void {
    const byte = index >> 3;
    const bit = 1 << (index & 7);
    if (((this.queued[byte] ?? 0) & bit) !== 0) return;
    this.queued[byte] = (this.queued[byte] ?? 0) | bit;
    this.push(index);
  }

  private push(index: number): void {
    if (this.count === this.queue.length) this.grow();
    this.queue[this.tail] = index;
    this.tail = (this.tail + 1) % this.queue.length;
    this.count++;
  }

  private grow(): void {
    const next = new Int32Array(this.queue.length * 2);
    for (let i = 0; i < this.count; i++) {
      next[i] = this.queue[(this.head + i) % this.queue.length] ?? 0;
    }
    this.queue = next;
    this.head = 0;
    this.tail = this.count;
  }

  private reset(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.queued.fill(0);
  }

  private clearQueued(index: number): void {
    const byte = index >> 3;
    this.queued[byte] = (this.queued[byte] ?? 0) & ~(1 << (index & 7));
  }
}
