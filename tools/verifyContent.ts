/**
 * Content reachability check. Every item must have a source: a block drop, a
 * bonus drop, an enemy/passive drop, a bucket fill, or a crafting recipe whose
 * own inputs are themselves reachable.
 *
 *   npm run verify
 *
 * Exits non-zero and prints the missing list when something is unreachable.
 */
import { ENEMIES } from '../src/data/enemies';
import { ItemId, ITEM_DEFINITIONS, bonusDropsForTile, dropForTile } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { TileId } from '../src/data/tiles';
import { PASSIVES } from '../src/entity/passive';

const reachable = new Set<ItemId>();

// Direct world sources.
for (const value of Object.values(TileId)) {
  if (typeof value !== 'number') continue;
  const drop = dropForTile(value);
  if (drop !== null) reachable.add(drop);
  for (const bonus of bonusDropsForTile(value)) reachable.add(bonus.item);
}
for (const enemy of Object.values(ENEMIES)) {
  for (const drop of enemy.drops) reachable.add(drop.item);
}
for (const passive of Object.values(PASSIVES)) {
  for (const drop of passive.drops) reachable.add(drop.item);
}
// Bucket filling produces the filled buckets from an empty one.
reachable.add(ItemId.WaterBucket);
reachable.add(ItemId.LavaBucket);

// Recipes: iterate to a fixpoint so chained recipes resolve.
let changed = true;
while (changed) {
  changed = false;
  for (const recipe of RECIPES) {
    if (reachable.has(recipe.output)) continue;
    if (recipe.inputs.every((input) => reachable.has(input.item))) {
      reachable.add(recipe.output);
      changed = true;
    }
  }
}

const allItems = Object.values(ItemId).filter((v): v is ItemId => typeof v === 'number');
const missingItems = allItems.filter((item) => !reachable.has(item));

const missingInputs: string[] = [];
for (const recipe of RECIPES) {
  for (const input of recipe.inputs) {
    if (!reachable.has(input.item)) {
      missingInputs.push(`${recipe.id} needs ${ITEM_DEFINITIONS[input.item].name}`);
    }
  }
}

console.log(`items: ${allItems.length}, reachable: ${reachable.size}`);
if (missingItems.length === 0 && missingInputs.length === 0) {
  console.log('OK: every item and recipe input is reachable.');
} else {
  for (const item of missingItems) console.log(`unreachable item: ${ITEM_DEFINITIONS[item].name}`);
  for (const line of missingInputs) console.log(`unreachable input: ${line}`);
  process.exitCode = 1;
}
