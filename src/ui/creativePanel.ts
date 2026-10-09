import { ItemId, itemDefinition } from '../data/items';
import { TEXT } from './text';

const GROUPS = ['All', 'Blocks', 'Tools', 'Weapons', 'Armor', 'Materials'] as const;
type Group = (typeof GROUPS)[number];

function groupOf(item: ItemId): Group {
  const def = itemDefinition(item);
  if (def.tile !== null) return 'Blocks';
  if (def.tool !== null) return 'Tools';
  if (def.weaponDamage > 0 || def.isBow) return 'Weapons';
  if (def.armorSlot !== null) return 'Armor';
  return 'Materials';
}

/** Creative item browser: grouped, searchable, gives a full stack on click. */
export class CreativePanel {
  private readonly root: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly groupSelect: HTMLSelectElement;
  private readonly allItems: ItemId[];
  public onPick: (item: ItemId) => void = () => {};

  public constructor(parent: HTMLElement) {
    this.allItems = Object.values(ItemId).filter((value): value is ItemId => typeof value === 'number');

    this.root = document.createElement('div');
    this.root.className = 'mt-overlay mt-overlay--center';
    const panel = document.createElement('div');
    panel.className = 'mt-panel mt-panel--creative';

    const title = document.createElement('div');
    title.textContent = TEXT.creative.title;
    title.className = 'mt-title';

    const controls = document.createElement('div');
    controls.className = 'mt-controls';
    this.groupSelect = document.createElement('select');
    this.groupSelect.className = 'mt-select';
    for (const group of GROUPS) {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      this.groupSelect.append(option);
    }
    this.search = document.createElement('input');
    this.search.type = 'text';
    this.search.placeholder = TEXT.creative.search;
    this.search.className = 'mt-input mt-input--fill';
    controls.append(this.groupSelect, this.search);

    this.grid = document.createElement('div');
    this.grid.className = 'mt-grid mt-grid--creative';

    panel.append(title, controls, this.grid);
    this.root.append(panel);
    parent.append(this.root);

    this.groupSelect.addEventListener('change', () => {
      this.rebuild();
    });
    this.search.addEventListener('input', () => {
      this.rebuild();
    });
  }

  public get open(): boolean {
    return this.root.style.display !== 'none';
  }

  public set(open: boolean): void {
    this.root.style.display = open ? 'flex' : 'none';
    if (open) this.rebuild();
  }

  public toggle(): void {
    this.set(!this.open);
  }

  public dispose(): void {
    this.root.remove();
  }

  private rebuild(): void {
    const query = this.search.value.trim().toLowerCase();
    const group = this.groupSelect.value as Group;
    this.grid.textContent = '';
    for (const item of this.allItems) {
      const def = itemDefinition(item);
      if (group !== 'All' && groupOf(item) !== group) continue;
      if (query.length > 0 && !def.name.toLowerCase().includes(query)) continue;
      const button = document.createElement('button');
      button.textContent = def.name;
      button.className = 'mt-slot mt-slot--creative';
      button.addEventListener('click', () => {
        this.onPick(item);
      });
      this.grid.append(button);
    }
  }
}
