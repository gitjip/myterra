import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { Furnace } from '../src/systems/furnace';
import { Inventory } from '../src/systems/inventory';

describe('furnace', () => {
  it('smelts ore into an ingot over time', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.IronOre, 3);
    inventory.addItem(ItemId.Coal, 1);
    const furnace = new Furnace();

    expect(furnace.addInput(ItemId.IronOre, inventory)).toBe(true);
    expect(furnace.addFuel(ItemId.Coal, inventory)).toBe(true);

    for (let i = 0; i < 200; i++) furnace.update(1 / 60);
    expect(furnace.output).toBe(ItemId.IronIngot);
    expect(furnace.outputCount).toBeGreaterThanOrEqual(1);

    furnace.collectOutput(inventory);
    expect(inventory.countOf(ItemId.IronIngot)).toBeGreaterThanOrEqual(1);
  });

  it('stops when the fuel runs out', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.IronOre, 50);
    inventory.addItem(ItemId.Wood, 1);
    const furnace = new Furnace();
    for (let i = 0; i < 50; i++) furnace.addInput(ItemId.IronOre, inventory);
    furnace.addFuel(ItemId.Wood, inventory);

    for (let i = 0; i < 2000; i++) furnace.update(1 / 60);
    expect(furnace.fuelSeconds).toBe(0);
    expect(furnace.outputCount).toBeGreaterThan(0);
    expect(furnace.outputCount).toBeLessThan(50);
  });

  it('cooks raw meat', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.RawMeat, 1);
    inventory.addItem(ItemId.Coal, 1);
    const furnace = new Furnace();
    furnace.addInput(ItemId.RawMeat, inventory);
    furnace.addFuel(ItemId.Coal, inventory);
    for (let i = 0; i < 200; i++) furnace.update(1 / 60);
    furnace.collectOutput(inventory);
    expect(inventory.countOf(ItemId.CookedMeat)).toBe(1);
  });

  it('rejects items that are not smeltable', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.Stone, 5);
    const furnace = new Furnace();
    expect(furnace.addInput(ItemId.Stone, inventory)).toBe(false);
    expect(furnace.addFuel(ItemId.Stone, inventory)).toBe(false);
  });
});
