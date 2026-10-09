import { describe, expect, it } from 'vitest';
import {
  ItemId,
  bonusDropsForTile,
  dropForTile,
  itemDefinition,
  stationOfTile,
  ITEM_DEFINITIONS,
} from '../src/data/items';
import { TileId } from '../src/data/tiles';

describe('content data', () => {
  it('maps the interactive blocks to their stations', () => {
    expect(stationOfTile(TileId.Workbench)).toBe('workbench');
    expect(stationOfTile(TileId.Anvil)).toBe('anvil');
    expect(stationOfTile(TileId.Furnace)).toBe('furnace');
    expect(stationOfTile(TileId.Chest)).toBe('chest');
    expect(stationOfTile(TileId.Bed)).toBe('bed');
    expect(stationOfTile(TileId.Stone)).toBeNull();
  });

  it('drops the new blocks as items', () => {
    expect(dropForTile(TileId.Obsidian)).toBe(ItemId.Obsidian);
    expect(dropForTile(TileId.Anvil)).toBe(ItemId.Anvil);
    expect(dropForTile(TileId.Bed)).toBe(ItemId.Bed);
    expect(bonusDropsForTile(TileId.Grass).some((d) => d.item === ItemId.Rope)).toBe(true);
  });

  it('sums each armor set to its documented reduction', () => {
    const sum = (a: ItemId, b: ItemId, c: ItemId): number =>
      itemDefinition(a).armorReduction +
      itemDefinition(b).armorReduction +
      itemDefinition(c).armorReduction;
    expect(sum(ItemId.WoodHelmet, ItemId.WoodChestplate, ItemId.WoodLeggings)).toBe(25);
    expect(sum(ItemId.IronHelmet, ItemId.IronChestplate, ItemId.IronLeggings)).toBe(40);
    expect(sum(ItemId.GoldHelmet, ItemId.GoldChestplate, ItemId.GoldLeggings)).toBe(55);
  });

  it('declares bow, ammo and bucket flags', () => {
    expect(itemDefinition(ItemId.Bow).isBow).toBe(true);
    expect(itemDefinition(ItemId.Arrow).isAmmo).toBe(true);
    expect(itemDefinition(ItemId.Arrow).stackMax).toBe(200);
    expect(itemDefinition(ItemId.WaterBucket).isBucket).toBe(true);
    expect(itemDefinition(ItemId.LavaBucket).isBucket).toBe(true);
    for (const item of Object.values(ItemId).filter((v): v is ItemId => typeof v === 'number')) {
      expect(ITEM_DEFINITIONS[item]).toBeDefined();
    }
  });
});
