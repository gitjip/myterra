import { describe, expect, it } from 'vitest';
import { ItemId } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { canCraft, craft, listRecipes } from '../src/systems/crafting';
import { Inventory } from '../src/systems/inventory';

describe('crafting', () => {
  it('crafts a workbench by hand', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.Wood, 12);
    const recipe = RECIPES.find((r) => r.output === ItemId.Workbench);
    if (!recipe) throw new Error('missing recipe');
    expect(canCraft(recipe, inventory)).toBe(true);
    expect(craft(recipe, inventory)).toBe(true);
    expect(inventory.countOf(ItemId.Workbench)).toBe(1);
    expect(inventory.countOf(ItemId.Wood)).toBe(2);
  });

  it('gates workbench recipes behind a nearby workbench', () => {
    const handRecipes = listRecipes(false);
    const benchRecipes = listRecipes(true);
    expect(handRecipes.some((r) => r.output === ItemId.WoodPickaxe)).toBe(false);
    expect(benchRecipes.some((r) => r.output === ItemId.WoodPickaxe)).toBe(true);
  });

  it('does not consume materials when they are missing', () => {
    const inventory = new Inventory();
    inventory.addItem(ItemId.Wood, 1);
    const recipe = RECIPES.find((r) => r.output === ItemId.WoodPickaxe);
    if (!recipe) throw new Error('missing recipe');
    expect(canCraft(recipe, inventory)).toBe(false);
    expect(craft(recipe, inventory)).toBe(false);
    expect(inventory.countOf(ItemId.Wood)).toBe(1);
  });

  it('can craft every non-furnace recipe from its own ingredients', () => {
    for (const recipe of RECIPES) {
      if (recipe.station === 'furnace') continue;
      const inventory = new Inventory();
      for (const input of recipe.inputs) inventory.addItem(input.item, input.count);
      expect(canCraft(recipe, inventory)).toBe(true);
      expect(craft(recipe, inventory)).toBe(true);
      expect(inventory.countOf(recipe.output)).toBeGreaterThanOrEqual(recipe.count);
    }
  });
});
