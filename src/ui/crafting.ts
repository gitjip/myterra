import { itemDefinition } from '../data/items';
import type { Recipe } from '../data/recipes';
import { canCraft, listRecipes } from '../systems/crafting';
import type { Inventory } from '../systems/inventory';

const PANEL: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '380px',
  maxHeight: '72vh',
  overflowY: 'auto',
  background: 'rgba(10, 12, 20, 0.95)',
  border: '1px solid #2a2f45',
  borderRadius: '6px',
  padding: '14px 16px',
  color: '#d7dceb',
  font: '13px/1.5 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '1500',
  display: 'none',
};

const ROW_BUTTON: Partial<CSSStyleDeclaration> = {
  padding: '3px 10px',
  background: '#1a1f2e',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '3px',
  font: 'inherit',
  cursor: 'pointer',
};

/** Minimal crafting list. Full drag-and-drop interaction lands in M13. */
export class CraftingPanel {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private signature = '';
  public onCraft: (recipe: Recipe) => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, PANEL);
    const title = document.createElement('div');
    title.textContent = 'Crafting';
    Object.assign(title.style, { fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' });
    this.body = document.createElement('div');
    this.root.append(title, this.body);
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

  public update(inventory: Inventory, hasWorkbench: boolean): void {
    if (!this.open) return;
    const signature = `${hasWorkbench ? 1 : 0}|${slotSignature(inventory)}`;
    if (signature === this.signature) return;
    this.signature = signature;

    this.body.textContent = '';
    for (const recipe of listRecipes(hasWorkbench)) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        padding: '3px 0',
      });
      const label = document.createElement('span');
      label.textContent = `${itemDefinition(recipe.output).name} x${recipe.count}  ←  ${recipe.inputs
        .map((input) => `${itemDefinition(input.item).name} x${input.count}`)
        .join(', ')}`;
      const button = document.createElement('button');
      button.textContent = 'Craft';
      Object.assign(button.style, ROW_BUTTON);
      const craftable = canCraft(recipe, inventory);
      button.disabled = !craftable;
      button.style.opacity = craftable ? '1' : '0.4';
      button.addEventListener('click', () => {
        this.onCraft(recipe);
      });
      row.append(label, button);
      this.body.append(row);
    }
  }

  public dispose(): void {
    this.root.remove();
  }
}

export function slotSignature(inventory: Inventory): string {
  const parts: string[] = [];
  for (let i = 0; i < inventory.size; i++) {
    const slot = inventory.getSlot(i);
    if (slot) parts.push(`${i}:${slot.item}:${slot.count}`);
  }
  return parts.join(',');
}
