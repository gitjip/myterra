import { SAND } from '../data/tuning';
import { tileDefinition, tileIdFromByte, TileId } from '../data/tiles';
import type { World } from './world';

/**
 * Sand falls one tile per tick, straight down or diagonally. It never merges
 * and never splits a tile; entering a liquid cell pushes the liquid aside.
 */
export class SandSystem {
  private readonly queue: number[] = [];
  private head = 0;
  private readonly queued: Uint8Array;

  public constructor(private readonly world: World) {
    this.queued = new Uint8Array((world.width * world.height + 7) >> 3);
  }

  public get activeCells(): number {
    return this.queue.length - this.head;
  }

  public wake(x: number, y: number): void {
    this.wakeIndex(this.world.idx(x, y));
  }

  /** Wakes a cell and its four neighbours, used after a tile edit. */
  public wakeNeighbourhood(x: number, y: number): void {
    this.wakeAround(x, y);
  }

  public clear(): void {
    this.queue.length = 0;
    this.head = 0;
    this.queued.fill(0);
  }

  public update(budgetMs: number): void {
    const started = performance.now();
    let processed = 0;
    while (
      this.head < this.queue.length &&
      processed < SAND.maxCellsPerTick &&
      performance.now() - started < budgetMs
    ) {
      const index = this.queue[this.head] as number;
      this.head++;
      this.clearQueued(index);
      processed++;
      this.process(index);
    }
    if (this.head >= this.queue.length) {
      this.queue.length = 0;
      this.head = 0;
    } else if (this.head > 4096) {
      this.queue.splice(0, this.head);
      this.head = 0;
    }
  }

  // -------------------------------------------------------------------------

  private process(index: number): void {
    if (tileIdFromByte(this.world.fg[index] ?? 0) !== TileId.Sand) return;
    const { width, xMin, yMin, yMax } = this.world;
    const col = index % width;
    const row = (index - col) / width;
    const x = xMin + col;
    const y = yMin + row;

    if (y < yMax) {
      const below = index + width;
      if (this.canFall(below)) {
        this.move(x, y, x, y + 1);
        return;
      }
      // Only roll off a vertical ledge (solid, non-sand support), never off
      // another grain, so a falling column stays intact until it lands.
      const belowIsSand = tileIdFromByte(this.world.fg[below] ?? 0) === TileId.Sand;
      if (this.isSolid(below) && !belowIsSand) {
        const firstDx = x % 2 === 0 ? -1 : 1;
        if (this.tryDiagonal(index, x, y, firstDx)) return;
        if (this.tryDiagonal(index, x, y, -firstDx)) return;
      }
    }
  }

  private tryDiagonal(index: number, x: number, y: number, dx: number): boolean {
    const { width, xMin, xMax } = this.world;
    const nx = x + dx;
    if (nx < xMin || nx > xMax) return false;
    if (this.isSolid(index + dx)) return false;
    const diagonal = index + dx + width;
    if (!this.canFall(diagonal)) return false;
    this.move(x, y, nx, y + 1);
    return true;
  }

  private canFall(index: number): boolean {
    return tileIdFromByte(this.world.fg[index] ?? 0) === TileId.Air;
  }

  private isSolid(index: number): boolean {
    return tileDefinition(tileIdFromByte(this.world.fg[index] ?? 0)).solid;
  }

  private move(x: number, y: number, nx: number, ny: number): void {
    // Placing the sand first displaces any liquid in the destination cell.
    this.world.setTile(nx, ny, TileId.Sand);
    this.world.setTile(x, y, TileId.Air);
    this.wakeAround(nx, ny);
    this.wakeAround(x, y);
    this.wake(x, y - 1);
  }

  private wakeAround(x: number, y: number): void {
    this.wake(x, y);
    this.wake(x - 1, y);
    this.wake(x + 1, y);
    this.wake(x, y - 1);
    this.wake(x, y + 1);
  }

  private wakeIndex(index: number): void {
    const byte = index >> 3;
    const bit = 1 << (index & 7);
    if (((this.queued[byte] ?? 0) & bit) !== 0) return;
    this.queued[byte] = (this.queued[byte] ?? 0) | bit;
    this.queue.push(index);
  }

  private clearQueued(index: number): void {
    const byte = index >> 3;
    this.queued[byte] = (this.queued[byte] ?? 0) & ~(1 << (index & 7));
  }
}
