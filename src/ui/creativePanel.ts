import { ItemId, itemDefinition } from '../data/items';
import { TEXT } from './text';

const OVERLAY: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(4, 6, 12, 0.7)',
  zIndex: '2400',
  font: '13px/1.5 ui-monospace, Menlo, Consolas, monospace',
  color: '#d7dceb',
};

const PANEL: Partial<CSSStyleDeclaration> = {
  width: '520px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  background: 'rgba(10, 12, 20, 0.97)',
  border: '1px solid #2a2f45',
  borderRadius: '6px',
  padding: '14px 16px',
};

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
    Object.assign(this.root.style, OVERLAY);
    const panel = document.createElement('div');
    Object.assign(panel.style, PANEL);

    const title = document.createElement('div');
    title.textContent = TEXT.creative.title;
    Object.assign(title.style, { fontWeight: 'bold', letterSpacing: '1px' });

    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '8px' });
    this.groupSelect = document.createElement('select');
    for (const group of GROUPS) {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      this.groupSelect.append(option);
    }
    this.search = document.createElement('input');
    this.search.type = 'text';
    this.search.placeholder = TEXT.creative.search;
    Object.assign(this.search.style, { flex: '1' });
    controls.append(this.groupSelect, this.search);

    this.grid = document.createElement('div');
    Object.assign(this.grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '4px',
      overflowY: 'auto',
      maxHeight: '58vh',
    } satisfies Partial<CSSStyleDeclaration>);

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
      Object.assign(button.style, {
        padding: '6px 4px',
        background: '#1a1f2e',
        color: '#d7dceb',
        border: '1px solid #2a2f45',
        borderRadius: '3px',
        cursor: 'pointer',
        font: 'inherit',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      } satisfies Partial<CSSStyleDeclaration>);
      button.addEventListener('click', () => {
        this.onPick(item);
      });
      this.grid.append(button);
    }
  }
}
