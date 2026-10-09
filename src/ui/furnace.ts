import { itemDefinition } from '../data/items';
import type { ItemId } from '../data/items';
import { FURNACE_RECIPES } from '../data/recipes';
import type { Furnace } from '../systems/furnace';
import type { Inventory } from '../systems/inventory';
import { slotSignature } from './inventory';

/** Minimal furnace dialog: insert ore/food, burn fuel, collect output. */
export class FurnacePanel {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly inputs: HTMLDivElement;
  private readonly collect: HTMLButtonElement;
  private signature = '';
  public onInsert: (item: ItemId) => void = () => {};
  public onCollect: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-panel mt-panel--fixed mt-panel--furnace';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.textContent = 'Furnace';
    title.className = 'mt-title mt-title--panel';

    this.status = document.createElement('div');
    this.status.className = 'mt-status mt-status--spaced';

    const track = document.createElement('div');
    track.className = 'mt-bar mt-bar--full';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'mt-bar__fill';
    this.progressFill.style.background = 'var(--mt-warn)';
    track.append(this.progressFill);

    this.inputs = document.createElement('div');

    this.collect = document.createElement('button');
    this.collect.textContent = 'Collect';
    this.collect.className = 'mt-button mt-button--spaced';
    this.collect.addEventListener('click', () => {
      this.onCollect();
    });

    this.root.append(title, this.status, track, this.inputs, this.collect);
    parent.append(this.root);
  }

  public get open(): boolean {
    return this.root.style.display !== 'none';
  }

  public set(open: boolean): void {
    this.root.style.display = open ? 'block' : 'none';
    if (open) this.signature = '';
  }

  public toggle(): void {
    this.set(!this.open);
  }

  public update(furnace: Furnace, inventory: Inventory): void {
    if (!this.open) return;
    const recipe = furnace.recipe;
    const input = furnace.input;
    const output = furnace.output;
    const status =
      `input ${input !== null ? itemDefinition(input).name : '-'}  ` +
      `output ${output !== null ? `${itemDefinition(output).name} x${furnace.outputCount}` : '-'}  ` +
      `fuel ${furnace.fuelSeconds.toFixed(1)}s` +
      (recipe ? `  (${recipe.time}s/batch)` : '');
    this.status.textContent = status;
    this.progressFill.style.width = `${Math.round(furnace.progressFraction * 100)}%`;
    this.collect.disabled = furnace.outputCount <= 0;

    const signature = `${slotSignature(inventory)}|${input ?? -1}|${output ?? -1}`;
    if (signature === this.signature) return;
    this.signature = signature;

    this.inputs.textContent = '';
    for (const r of FURNACE_RECIPES) {
      const first = r.inputs[0];
      if (!first) continue;
      const row = document.createElement('div');
      row.className = 'mt-row';
      const label = document.createElement('span');
      label.textContent = `${itemDefinition(r.output).name} ← ${itemDefinition(first.item).name}`;
      const button = document.createElement('button');
      button.textContent = 'Insert';
      button.className = 'mt-button mt-button--small';
      const available = inventory.countOf(first.item) > 0;
      button.disabled = !available;
      button.addEventListener('click', () => {
        this.onInsert(first.item);
      });
      row.append(label, button);
      this.inputs.append(row);
    }
  }

  public dispose(): void {
    this.root.remove();
  }
}
