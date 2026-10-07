import { itemDefinition } from '../data/items';
import type { ItemId } from '../data/items';
import { FURNACE_RECIPES } from '../data/recipes';
import type { Furnace } from '../systems/furnace';
import type { Inventory } from '../systems/inventory';
import { slotSignature } from './crafting';

const PANEL: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '360px',
  background: 'rgba(10, 12, 20, 0.95)',
  border: '1px solid #2a2f45',
  borderRadius: '6px',
  padding: '14px 16px',
  color: '#d7dceb',
  font: '13px/1.5 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '1500',
  display: 'none',
};

const BUTTON: Partial<CSSStyleDeclaration> = {
  padding: '3px 10px',
  background: '#1a1f2e',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '3px',
  font: 'inherit',
  cursor: 'pointer',
};

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
    Object.assign(this.root.style, PANEL);

    const title = document.createElement('div');
    title.textContent = 'Furnace';
    Object.assign(title.style, { fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' });

    this.status = document.createElement('div');
    Object.assign(this.status.style, { marginBottom: '6px', color: '#8b93b0' });

    const track = document.createElement('div');
    Object.assign(track.style, {
      width: '100%',
      height: '10px',
      background: '#0e1220',
      border: '1px solid #2a2f45',
      borderRadius: '3px',
      overflow: 'hidden',
      marginBottom: '8px',
    });
    this.progressFill = document.createElement('div');
    Object.assign(this.progressFill.style, { width: '0%', height: '100%', background: '#d9923b' });
    track.append(this.progressFill);

    this.inputs = document.createElement('div');

    this.collect = document.createElement('button');
    this.collect.textContent = 'Collect';
    Object.assign(this.collect.style, BUTTON);
    this.collect.style.marginTop = '8px';
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
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '2px 0',
      });
      const label = document.createElement('span');
      label.textContent = `${itemDefinition(r.output).name} ← ${itemDefinition(first.item).name}`;
      const button = document.createElement('button');
      button.textContent = 'Insert';
      Object.assign(button.style, BUTTON);
      const available = inventory.countOf(first.item) > 0;
      button.disabled = !available;
      button.style.opacity = available ? '1' : '0.4';
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
