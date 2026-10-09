import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { INVENTORY } from '../src/data/tuning';
import { ContainerStore } from '../src/systems/containers';

describe('container store', () => {
  it('creates empty chests on demand', () => {
    const store = new ContainerStore();
    const slots = store.ensure(4, 9);
    expect(slots.length).toBe(INVENTORY.chestSlots);
    expect(store.get(4, 9)).toBe(slots);
    slots[0] = { item: ItemId.Stone, count: 15 };
    expect(store.get(4, 9)?.[0]).toEqual({ item: ItemId.Stone, count: 15 });
  });

  it('round-trips through entries/restore', () => {
    const store = new ContainerStore();
    store.ensure(4, 9)[0] = { item: ItemId.Stone, count: 15 };
    store.ensure(30, 12)[2] = { item: ItemId.Wood, count: 7 };

    const restored = new ContainerStore();
    restored.restore(store.entries());
    expect(restored.get(4, 9)?.[0]).toEqual({ item: ItemId.Stone, count: 15 });
    expect(restored.get(30, 12)?.[2]).toEqual({ item: ItemId.Wood, count: 7 });
  });

  it('removes a chest from either half', () => {
    const store = new ContainerStore();
    store.ensure(4, 9)[0] = { item: ItemId.Stone, count: 1 };
    const removed = store.removeNear(5, 9); // right half
    expect(removed?.[0]?.item).toBe(ItemId.Stone);
    expect(store.get(4, 9)).toBeNull();
    expect(store.removeNear(9, 9)).toBeNull();
  });
});
