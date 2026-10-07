import { RECIPES } from '../data/recipes';
import type { Recipe } from '../data/recipes';
import type { Inventory } from './inventory';

/**
 * Shape-agnostic crafting: a recipe is just a multiset of ingredients. The
 * station only gates which recipes are listed; grid arrangement is irrelevant.
 */
export function recipeAvailable(recipe: Recipe, hasWorkbench: boolean): boolean {
  if (recipe.station === 'furnace') return false;
  if (recipe.station === 'workbench') return hasWorkbench;
  return true;
}

export function canCraft(recipe: Recipe, inventory: Inventory): boolean {
  return recipe.inputs.every((input) => inventory.countOf(input.item) >= input.count);
}

/** Consumes the inputs and adds the output. Returns false when materials are missing. */
export function craft(recipe: Recipe, inventory: Inventory): boolean {
  if (!canCraft(recipe, inventory)) return false;
  for (const input of recipe.inputs) inventory.removeItem(input.item, input.count);
  inventory.addItem(recipe.output, recipe.count);
  return true;
}

/** Recipes the UI should list given the stations in reach. */
export function listRecipes(hasWorkbench: boolean): Recipe[] {
  return RECIPES.filter((recipe) => recipeAvailable(recipe, hasWorkbench));
}
