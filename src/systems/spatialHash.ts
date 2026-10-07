/**
 * A tiny uniform-grid spatial hash. Entities are few, so this is about keeping
 * neighbour queries local rather than raw speed.
 */
export class SpatialHash<T> {
  private readonly cells = new Map<string, Set<T>>();

  public constructor(private readonly cellSize = 8) {
    if (cellSize <= 0) throw new RangeError('SpatialHash cellSize must be positive');
  }

  public insert(item: T, x: number, y: number): void {
    const key = this.key(x, y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(item);
  }

  public remove(item: T, x: number, y: number): void {
    const cell = this.cells.get(this.key(x, y));
    if (!cell) return;
    cell.delete(item);
    if (cell.size === 0) this.cells.delete(this.key(x, y));
  }

  /** Items in every cell overlapping the axis-aligned box, de-duplicated. */
  public queryRect(minX: number, minY: number, maxX: number, maxY: number): T[] {
    const result = new Set<T>();
    const cx0 = this.cellIndex(minX);
    const cy0 = this.cellIndex(minY);
    const cx1 = this.cellIndex(maxX);
    const cy1 = this.cellIndex(maxY);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (cell) for (const item of cell) result.add(item);
      }
    }
    return [...result];
  }

  public clear(): void {
    this.cells.clear();
  }

  public get size(): number {
    let total = 0;
    for (const cell of this.cells.values()) total += cell.size;
    return total;
  }

  private key(x: number, y: number): string {
    return `${this.cellIndex(x)},${this.cellIndex(y)}`;
  }

  private cellIndex(value: number): number {
    return Math.floor(value / this.cellSize);
  }
}
