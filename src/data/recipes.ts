import { ItemId } from './items';

export type CraftStation = 'hand' | 'workbench' | 'furnace' | 'anvil';

export interface Ingredient {
  readonly item: ItemId;
  readonly count: number;
}

export interface Recipe {
  readonly id: string;
  readonly output: ItemId;
  readonly count: number;
  readonly inputs: readonly Ingredient[];
  readonly station: CraftStation;
  /** Furnace batches only: seconds to process one batch. */
  readonly time: number;
}

const r = (
  id: string,
  output: ItemId,
  count: number,
  station: CraftStation,
  inputs: ReadonlyArray<[ItemId, number]>,
  time = 0,
): Recipe => ({
  id,
  output,
  count,
  station,
  inputs: inputs.map(([item, c]) => ({ item, count: c })),
  time,
});

export const RECIPES: readonly Recipe[] = [
  r('workbench', ItemId.Workbench, 1, 'hand', [[ItemId.Wood, 10]]),
  r('torch', ItemId.Torch, 3, 'hand', [
    [ItemId.Wood, 1],
    [ItemId.Coal, 1],
  ]),

  r('wood-pickaxe', ItemId.WoodPickaxe, 1, 'workbench', [[ItemId.Wood, 3]]),
  r('wood-axe', ItemId.WoodAxe, 1, 'workbench', [[ItemId.Wood, 3]]),
  r('wood-hammer', ItemId.WoodHammer, 1, 'workbench', [[ItemId.Wood, 3]]),
  r('wood-shovel', ItemId.WoodShovel, 1, 'workbench', [[ItemId.Wood, 2]]),
  r('wood-sword', ItemId.WoodSword, 1, 'workbench', [[ItemId.Wood, 3]]),

  r('stone-pickaxe', ItemId.StonePickaxe, 1, 'workbench', [
    [ItemId.Stone, 3],
    [ItemId.Wood, 1],
  ]),
  r('stone-axe', ItemId.StoneAxe, 1, 'workbench', [
    [ItemId.Stone, 3],
    [ItemId.Wood, 1],
  ]),
  r('stone-hammer', ItemId.StoneHammer, 1, 'workbench', [
    [ItemId.Stone, 3],
    [ItemId.Wood, 1],
  ]),
  r('stone-shovel', ItemId.StoneShovel, 1, 'workbench', [
    [ItemId.Stone, 2],
    [ItemId.Wood, 1],
  ]),
  r('stone-sword', ItemId.StoneSword, 1, 'workbench', [
    [ItemId.Stone, 3],
    [ItemId.Wood, 1],
  ]),

  r('iron-pickaxe', ItemId.IronPickaxe, 1, 'workbench', [
    [ItemId.IronIngot, 3],
    [ItemId.Wood, 1],
  ]),
  r('iron-axe', ItemId.IronAxe, 1, 'workbench', [
    [ItemId.IronIngot, 3],
    [ItemId.Wood, 1],
  ]),
  r('iron-hammer', ItemId.IronHammer, 1, 'workbench', [
    [ItemId.IronIngot, 3],
    [ItemId.Wood, 1],
  ]),
  r('iron-shovel', ItemId.IronShovel, 1, 'workbench', [
    [ItemId.IronIngot, 2],
    [ItemId.Wood, 1],
  ]),
  r('iron-sword', ItemId.IronSword, 1, 'workbench', [
    [ItemId.IronIngot, 3],
    [ItemId.Wood, 1],
  ]),

  r('furnace', ItemId.Furnace, 1, 'workbench', [
    [ItemId.Stone, 20],
    [ItemId.Wood, 4],
    [ItemId.Torch, 3],
  ]),
  r('chest', ItemId.Chest, 1, 'workbench', [[ItemId.Wood, 8]]),
  r('anvil', ItemId.Anvil, 1, 'workbench', [[ItemId.IronIngot, 10]]),
  r('bed', ItemId.Bed, 1, 'workbench', [
    [ItemId.Wood, 15],
    [ItemId.Silk, 8],
  ]),

  r('bow', ItemId.Bow, 1, 'workbench', [
    [ItemId.Wood, 8],
    [ItemId.Rope, 3],
  ]),
  r('arrow', ItemId.Arrow, 4, 'workbench', [
    [ItemId.Wood, 1],
    [ItemId.Stone, 1],
  ]),
  r('water-bucket', ItemId.WaterBucket, 1, 'workbench', [[ItemId.IronIngot, 3]]),
  r('lava-bucket', ItemId.LavaBucket, 1, 'workbench', [[ItemId.IronIngot, 3]]),

  r('wood-helmet', ItemId.WoodHelmet, 1, 'anvil', [[ItemId.Wood, 10]]),
  r('wood-chestplate', ItemId.WoodChestplate, 1, 'anvil', [[ItemId.Wood, 15]]),
  r('wood-leggings', ItemId.WoodLeggings, 1, 'anvil', [[ItemId.Wood, 12]]),
  r('iron-helmet', ItemId.IronHelmet, 1, 'anvil', [[ItemId.IronIngot, 10]]),
  r('iron-chestplate', ItemId.IronChestplate, 1, 'anvil', [[ItemId.IronIngot, 15]]),
  r('iron-leggings', ItemId.IronLeggings, 1, 'anvil', [[ItemId.IronIngot, 12]]),
  r('gold-helmet', ItemId.GoldHelmet, 1, 'anvil', [[ItemId.GoldIngot, 10]]),
  r('gold-chestplate', ItemId.GoldChestplate, 1, 'anvil', [[ItemId.GoldIngot, 15]]),
  r('gold-leggings', ItemId.GoldLeggings, 1, 'anvil', [[ItemId.GoldIngot, 12]]),

  r('iron-ingot', ItemId.IronIngot, 1, 'furnace', [[ItemId.IronOre, 1]], 3),
  r('gold-ingot', ItemId.GoldIngot, 1, 'furnace', [[ItemId.GoldOre, 1]], 3),
  r('cooked-meat', ItemId.CookedMeat, 1, 'furnace', [[ItemId.RawMeat, 1]], 2),
];

export const FURNACE_RECIPES: readonly Recipe[] = RECIPES.filter(
  (recipe) => recipe.station === 'furnace',
);

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}
