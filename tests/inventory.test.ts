import { describe, expect, it } from 'vitest';
import { ItemId, itemDefinition } from '../src/data/items';
import { Inventory } from '../src/systems/inventory';

describe('Inventory', () => {
  it('stacks into existing slots before using empty ones', () => {
    const inventory = new Inventory(12);
    expect(inventory.addItem(ItemId.Dirt, 30)).toBe(0);
    expect(inventory.addItem(ItemId.Dirt, 5)).toBe(0);
    expect(inventory.getSlot(0)).toEqual({ item: ItemId.Dirt, count: 35 });
    expect(inventory.countOf(ItemId.Dirt)).toBe(35);
  });

  it('spills into a new slot when a stack hits its maximum', () => {
    const inventory = new Inventory(12);
    const max = itemDefinition(ItemId.Dirt).stackMax;
    inventory.addItem(ItemId.Dirt, max);
    inventory.addItem(ItemId.Dirt, 4);
    expect(inventory.getSlot(0)).toEqual({ item: ItemId.Dirt, count: max });
    expect(inventory.getSlot(1)).toEqual({ item: ItemId.Dirt, count: 4 });
  });

  it('reports the leftover when there is no room', () => {
    const inventory = new Inventory(10);
    const max = itemDefinition(ItemId.Stone).stackMax;
    for (let i = 0; i < 10; i++) inventory.addItem(ItemId.Stone, max);
    expect(inventory.addItem(ItemId.Stone, 10)).toBe(10);
  });

  it('does not stack single-slot tools', () => {
    const inventory = new Inventory(12);
    inventory.addItem(ItemId.WoodPickaxe);
    inventory.addItem(ItemId.WoodPickaxe);
    expect(inventory.getSlot(0)?.count).toBe(1);
    expect(inventory.getSlot(1)?.count).toBe(1);
  });

  it('removes items across slots and deep into a stack', () => {
    const inventory = new Inventory(12);
    inventory.addItem(ItemId.Wood, 10);
    inventory.addItem(ItemId.Wood, 10);
    expect(inventory.removeItem(ItemId.Wood, 15)).toBe(15);
    expect(inventory.countOf(ItemId.Wood)).toBe(5);
    expect(inventory.removeItem(ItemId.Stone, 3)).toBe(0);
  });

  it('splits a stack into the first empty slot', () => {
    const inventory = new Inventory(12);
    inventory.addItem(ItemId.Sand, 10);
    expect(inventory.split(0)).toBe(true);
    expect(inventory.getSlot(0)?.count).toBe(5);
    expect(inventory.getSlot(1)?.count).toBe(5);
    expect(inventory.split(2)).toBe(false);
  });

  it('merges matching stacks and swaps mismatched ones', () => {
    const inventory = new Inventory(12);
    inventory.addItem(ItemId.Dirt, 20);
    inventory.addItem(ItemId.Dirt, 30);
    inventory.split(0);
    inventory.move(0, 1);
    expect(inventory.getSlot(1)?.count).toBe(50);
    expect(inventory.getSlot(0)).toBeNull();

    inventory.addItem(ItemId.Stone, 8);
    inventory.move(0, 1);
    expect(inventory.getSlot(0)?.item).toBe(ItemId.Dirt);
    expect(inventory.getSlot(1)?.item).toBe(ItemId.Stone);
  });

  it('wraps hotbar selection and emits events', () => {
    const inventory = new Inventory(12);
    let changes = 0;
    let selected = -1;
    inventory.emitter.on('change', () => changes++);
    inventory.emitter.on('select', (index) => {
      selected = index;
    });

    inventory.addItem(ItemId.Torch, 3);
    expect(changes).toBeGreaterThan(0);
    inventory.select(3);
    expect(selected).toBe(3);
    inventory.select(13);
    expect(inventory.selected).toBe(3);
  });
});
