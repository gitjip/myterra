import type { ItemId } from '../data/items';
import { itemDefinition } from '../data/items';
import { FURNACE_RECIPES } from '../data/recipes';
import type { Recipe } from '../data/recipes';
import type { Inventory } from './inventory';

/** A single-slot furnace: one input stack, one output stack and a fuel pool. */
export class Furnace {
  private inputItem: ItemId | null = null;
  private inputCount = 0;
  private outItem: ItemId | null = null;
  private outCount = 0;
  private fuel = 0;
  private progressSeconds = 0;

  public get input(): ItemId | null {
    return this.inputItem;
  }

  public get output(): ItemId | null {
    return this.outItem;
  }

  public get outputCount(): number {
    return this.outCount;
  }

  public get fuelSeconds(): number {
    return this.fuel;
  }

  public get recipe(): Recipe | null {
    return this.inputItem === null ? null : (this.recipeFor(this.inputItem) ?? null);
  }

  public get progressFraction(): number {
    const recipe = this.recipe;
    if (!recipe || recipe.time <= 0) return 0;
    return Math.min(1, this.progressSeconds / recipe.time);
  }

  public addInput(item: ItemId, inventory: Inventory): boolean {
    if (!this.recipeFor(item)) return false;
    if (this.inputItem !== null && this.inputItem !== item) return false;
    if (inventory.removeItem(item, 1) < 1) return false;
    this.inputItem = item;
    this.inputCount++;
    return true;
  }

  public addFuel(item: ItemId, inventory: Inventory): boolean {
    const value = itemDefinition(item).fuelValue;
    if (value <= 0) return false;
    if (inventory.removeItem(item, 1) < 1) return false;
    this.fuel += value;
    return true;
  }

  public update(dt: number): void {
    const recipe = this.recipe;
    if (!recipe || this.inputCount <= 0) return;
    if (this.outItem !== null && this.outItem !== recipe.output) return;
    if (this.fuel <= 0) return;

    this.fuel = Math.max(0, this.fuel - dt);
    if (this.fuel <= 0) return;

    this.progressSeconds += dt;
    if (this.progressSeconds < recipe.time) return;

    this.progressSeconds -= recipe.time;
    this.inputCount--;
    if (this.inputCount <= 0) this.inputItem = null;
    this.outItem = recipe.output;
    this.outCount += recipe.count;
  }

  /** Moves finished output into the inventory. Returns how many were moved. */
  public collectOutput(inventory: Inventory): number {
    if (this.outItem === null || this.outCount <= 0) return 0;
    const leftover = inventory.addItem(this.outItem, this.outCount);
    const moved = this.outCount - leftover;
    this.outCount = leftover;
    if (this.outCount <= 0) this.outItem = null;
    return moved;
  }

  private recipeFor(item: ItemId): Recipe | undefined {
    return FURNACE_RECIPES.find((recipe) => {
      const first = recipe.inputs[0];
      return recipe.inputs.length === 1 && first !== undefined && first.item === item;
    });
  }
}
