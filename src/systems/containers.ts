import { INVENTORY } from '../data/tuning';
import type { InventorySlot } from './inventory';

export interface StoredChest {
  readonly x: number;
  readonly y: number;
  readonly slots: ReadonlyArray<InventorySlot>;
}

/**
 * Chest contents keyed by their world coordinates. Chests occupy two tiles, so
 * the origin (left column) is used as the key. Contents live here rather than
 * on the tile and are serialised through the save layer.
 */
export class ContainerStore {
  private readonly chests = new Map<string, InventorySlot[]>();

  public get(x: number, y: number): InventorySlot[] | null {
    return this.chests.get(this.key(x, y)) ?? null;
  }

  /** Returns the chest's slots, creating an empty chest if there is none. */
  public ensure(x: number, y: number): InventorySlot[] {
    const key = this.key(x, y);
    let slots = this.chests.get(key);
    if (!slots) {
      slots = new Array<InventorySlot>(INVENTORY.chestSlots).fill(null);
      this.chests.set(key, slots);
    }
    return slots;
  }

  public remove(x: number, y: number): InventorySlot[] | null {
    const key = this.key(x, y);
    const slots = this.chests.get(key) ?? null;
    this.chests.delete(key);
    return slots;
  }

  /** Removes the chest at either half of a 2x1 block. */
  public removeNear(x: number, y: number): InventorySlot[] | null {
    return this.remove(x, y) ?? this.remove(x - 1, y);
  }

  public entries(): StoredChest[] {
    const out: StoredChest[] = [];
    for (const [key, slots] of this.chests) {
      const comma = key.indexOf(',');
      out.push({
        x: Number(key.slice(0, comma)),
        y: Number(key.slice(comma + 1)),
        slots,
      });
    }
    return out;
  }

  public restore(chests: ReadonlyArray<StoredChest>): void {
    this.chests.clear();
    for (const chest of chests) {
      const slots = new Array<InventorySlot>(INVENTORY.chestSlots).fill(null);
      for (let i = 0; i < slots.length; i++) {
        const incoming = chest.slots[i] ?? null;
        slots[i] = incoming ? { item: incoming.item, count: incoming.count } : null;
      }
      this.chests.set(this.key(chest.x, chest.y), slots);
    }
  }

  public clear(): void {
    this.chests.clear();
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
