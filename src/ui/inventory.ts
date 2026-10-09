import { itemDefinition } from '../data/items';
import type { ItemId } from '../data/items';
import { INVENTORY } from '../data/tuning';
import { EQUIPMENT_SLOTS } from '../systems/inventory';
import type { EquipmentSlot, Inventory, InventorySlot, ItemStack } from '../systems/inventory';

type SlotRef =
  | { readonly kind: 'inv'; readonly index: number }
  | { readonly kind: 'equip'; readonly slot: EquipmentSlot }
  | { readonly kind: 'chest'; readonly index: number };

const PANEL: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(10, 12, 20, 0.95)',
  border: '1px solid #2a2f45',
  borderRadius: '6px',
  padding: '12px 14px',
  color: '#d7dceb',
  font: '12px/1.4 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '1400',
  display: 'none',
};

const SLOT: Partial<CSSStyleDeclaration> = {
  position: 'relative',
  width: '36px',
  height: '36px',
  background: 'rgba(6, 8, 14, 0.7)',
  border: '1px solid #2a2f45',
  borderRadius: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

/**
 * Inventory + equipment + chest panel. Click-based item moving (pick up / put
 * down / swap), shift for quick move, right-click to place one or split a
 * stack, and a floating cursor stack. Full crafting UI stays in M13.
 */
export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly mainGrid: HTMLDivElement;
  private readonly equipGrid: HTMLDivElement;
  private readonly chestWrap: HTMLDivElement;
  private readonly chestGrid: HTMLDivElement;
  private readonly cursorEl: HTMLDivElement;
  private readonly slotEls = new Map<string, HTMLDivElement>();
  private inventory: Inventory | null = null;
  private chest: InventorySlot[] | null = null;
  private cursorStack: ItemStack | null = null;
  private signature = '';
  private openState = false;

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, PANEL);

    const title = document.createElement('div');
    title.textContent = 'Inventory';
    Object.assign(title.style, { fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' });

    const body = document.createElement('div');
    Object.assign(body.style, { display: 'flex', gap: '14px' });

    this.mainGrid = this.makeGrid(4, 10);
    this.equipGrid = this.makeGrid(4, 1);

    const side = document.createElement('div');
    const sideLabel = document.createElement('div');
    sideLabel.textContent = 'Equipment';
    Object.assign(sideLabel.style, { color: '#8b93b0', marginBottom: '4px' });
    side.append(sideLabel, this.equipGrid);

    body.append(this.mainGrid, side);

    this.chestWrap = document.createElement('div');
    Object.assign(this.chestWrap.style, { marginTop: '10px', display: 'none' });
    const chestLabel = document.createElement('div');
    chestLabel.textContent = 'Chest';
    Object.assign(chestLabel.style, { color: '#8b93b0', marginBottom: '4px' });
    this.chestGrid = this.makeGrid(2, 10);
    this.chestWrap.append(chestLabel, this.chestGrid);

    this.root.append(title, body, this.chestWrap);

    this.cursorEl = document.createElement('div');
    Object.assign(this.cursorEl.style, {
      position: 'fixed',
      pointerEvents: 'none',
      padding: '2px 6px',
      background: 'rgba(6, 8, 14, 0.9)',
      border: '1px solid #d7dceb',
      borderRadius: '3px',
      font: '11px ui-monospace, monospace',
      color: '#e6e9f2',
      zIndex: '1500',
      display: 'none',
    });
    parent.append(this.root, this.cursorEl);

    document.addEventListener('mousemove', (event) => {
      this.cursorEl.style.left = `${event.clientX + 10}px`;
      this.cursorEl.style.top = `${event.clientY + 10}px`;
    });
    this.bindSlots();
  }

  public get open(): boolean {
    return this.openState;
  }

  public setOpen(open: boolean): void {
    this.openState = open;
    this.root.style.display = open ? 'block' : 'none';
    if (!open) this.releaseCursor();
    this.signature = '';
  }

  public bind(inventory: Inventory, chest: InventorySlot[] | null): void {
    this.inventory = inventory;
    this.chest = chest;
    this.chestWrap.style.display = chest ? 'block' : 'none';
  }

  public update(): void {
    if (!this.openState) return;
    const signature = this.buildSignature();
    if (signature === this.signature) return;
    this.signature = signature;
    for (const [key, element] of this.slotEls) {
      this.paint(elementRef(key), element);
    }
    this.paintCursor();
  }

  public dispose(): void {
    this.root.remove();
    this.cursorEl.remove();
  }

  // --- internals -----------------------------------------------------------

  private makeGrid(rows: number, cols: number): HTMLDivElement {
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 36px)`,
      gridAutoRows: '36px',
      gap: '3px',
    } satisfies Partial<CSSStyleDeclaration>);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) grid.append(document.createElement('div'));
    }
    return grid;
  }

  private bindSlots(): void {
    const register = (grid: HTMLDivElement, makeRef: (order: number) => SlotRef): void => {
      const children = Array.from(grid.children) as HTMLDivElement[];
      children.forEach((element, order) => {
        const ref = makeRef(order);
        const key = refKey(ref);
        Object.assign(element.style, SLOT);
        this.slotEls.set(key, element);
        element.addEventListener('mousedown', (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          this.onClick(ref, event.shiftKey);
        });
        element.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          this.onRightClick(ref);
        });
      });
    };
    register(this.mainGrid, (order) => ({ kind: 'inv', index: order }));
    register(this.equipGrid, (order) => ({
      kind: 'equip',
      slot: EQUIPMENT_SLOTS[order] ?? 'helmet',
    }));
    register(this.chestGrid, (order) => ({ kind: 'chest', index: order }));
  }

  private onClick(ref: SlotRef, shift: boolean): void {
    if (shift) {
      this.quickMove(ref);
      this.signature = '';
      this.update();
      return;
    }
    if (this.cursorStack) this.placeInto(ref, false);
    else this.pickUp(ref);
    this.signature = '';
    this.update();
  }

  private onRightClick(ref: SlotRef): void {
    if (this.cursorStack) this.placeInto(ref, true);
    else this.split(ref);
    this.signature = '';
    this.update();
  }

  private pickUp(ref: SlotRef): void {
    const stack = this.get(ref);
    if (!stack) return;
    this.cursorStack = { item: stack.item, count: stack.count };
    this.set(ref, null);
  }

  private split(ref: SlotRef): void {
    const stack = this.get(ref);
    if (!stack) return;
    if (stack.count >= 2) {
      const half = Math.floor(stack.count / 2);
      this.cursorStack = { item: stack.item, count: half };
      stack.count -= half;
      this.set(ref, stack);
    } else {
      this.cursorStack = { item: stack.item, count: 1 };
      this.set(ref, null);
    }
  }

  private placeInto(ref: SlotRef, one: boolean): void {
    const cursor = this.cursorStack;
    if (!cursor || !this.accepts(ref, cursor.item)) return;
    const target = this.get(ref);
    const max = itemDefinition(cursor.item).stackMax;

    if (target && target.item !== cursor.item) {
      if (one) return;
      this.set(ref, { item: cursor.item, count: cursor.count });
      this.cursorStack = { item: target.item, count: target.count };
      return;
    }

    const move = target
      ? Math.min(max - target.count, one ? 1 : cursor.count)
      : one
        ? 1
        : cursor.count;
    if (move <= 0) return;
    if (target) {
      target.count += move;
      this.set(ref, target);
    } else {
      this.set(ref, { item: cursor.item, count: move });
    }
    cursor.count -= move;
    if (cursor.count <= 0) this.cursorStack = null;
  }

  private quickMove(ref: SlotRef): void {
    const stack = this.get(ref);
    if (!stack) return;
    let remaining = stack.count;
    const candidates = this.quickCandidates(ref, stack.item);

    for (const candidate of candidates) {
      if (remaining <= 0) break;
      const target = this.get(candidate);
      if (!target || target.item !== stack.item) continue;
      const room = itemDefinition(target.item).stackMax - target.count;
      const move = Math.min(room, remaining);
      if (move <= 0) continue;
      target.count += move;
      this.set(candidate, target);
      remaining -= move;
    }
    for (const candidate of candidates) {
      if (remaining <= 0) break;
      if (this.get(candidate) || !this.accepts(candidate, stack.item)) continue;
      const move = Math.min(itemDefinition(stack.item).stackMax, remaining);
      this.set(candidate, { item: stack.item, count: move });
      remaining -= move;
    }
    this.set(ref, remaining > 0 ? { item: stack.item, count: remaining } : null);
  }

  private quickCandidates(ref: SlotRef, item: ItemId): SlotRef[] {
    const candidates: SlotRef[] = [];
    if (ref.kind === 'chest' || ref.kind === 'equip') {
      for (let i = 0; i < this.inventorySize(); i++) candidates.push({ kind: 'inv', index: i });
      return candidates;
    }
    const def = itemDefinition(item);
    if (def.armorSlot) candidates.push({ kind: 'equip', slot: def.armorSlot });
    if (def.isAmmo) candidates.push({ kind: 'equip', slot: 'ammo' });
    if (this.chest) {
      for (let i = 0; i < this.chest.length; i++) candidates.push({ kind: 'chest', index: i });
      return candidates;
    }
    const hotbar = ref.index < INVENTORY.hotbar;
    const start = hotbar ? INVENTORY.hotbar : 0;
    const end = hotbar ? this.inventorySize() : INVENTORY.hotbar;
    for (let i = start; i < end; i++) candidates.push({ kind: 'inv', index: i });
    return candidates;
  }

  private accepts(ref: SlotRef, item: ItemId): boolean {
    if (ref.kind !== 'equip') return true;
    const def = itemDefinition(item);
    if (ref.slot === 'ammo') return def.isAmmo;
    return def.armorSlot === ref.slot;
  }

  private get(ref: SlotRef): InventorySlot {
    if (ref.kind === 'chest') return this.chest?.[ref.index] ?? null;
    if (ref.kind === 'equip') return this.inventory?.getEquipment(ref.slot) ?? null;
    return this.inventory?.getSlot(ref.index) ?? null;
  }

  private set(ref: SlotRef, stack: InventorySlot): void {
    if (ref.kind === 'chest') {
      if (this.chest) this.chest[ref.index] = stack;
      return;
    }
    if (ref.kind === 'equip') {
      this.inventory?.setEquipment(ref.slot, stack);
      return;
    }
    this.inventory?.setSlot(ref.index, stack);
  }

  private inventorySize(): number {
    return this.inventory?.size ?? 0;
  }

  private buildSignature(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.inventorySize(); i++)
      parts.push(slotSig(this.get({ kind: 'inv', index: i })));
    for (const slot of EQUIPMENT_SLOTS) parts.push(slotSig(this.get({ kind: 'equip', slot })));
    if (this.chest)
      for (let i = 0; i < this.chest.length; i++)
        parts.push(slotSig(this.get({ kind: 'chest', index: i })));
    return parts.join('|');
  }

  private paint(ref: SlotRef, element: HTMLDivElement): void {
    const stack = this.get(ref);
    element.textContent = '';
    if (ref.kind === 'equip' && !stack) {
      const label = document.createElement('span');
      label.textContent = equipAbbrev(ref.slot);
      Object.assign(label.style, { color: '#3f465c', fontSize: '9px' });
      element.append(label);
      return;
    }
    if (!stack) return;
    const label = document.createElement('span');
    label.textContent = shortLabel(itemDefinition(stack.item).name);
    Object.assign(label.style, { fontSize: '9px', textAlign: 'center', lineHeight: '1.1' });
    element.append(label);
    if (stack.count > 1) {
      const count = document.createElement('span');
      count.textContent = String(stack.count);
      Object.assign(count.style, {
        position: 'absolute',
        right: '2px',
        bottom: '0',
        fontSize: '9px',
        color: '#f0d58c',
      });
      element.append(count);
    }
  }

  private paintCursor(): void {
    if (!this.cursorStack) {
      this.cursorEl.style.display = 'none';
      return;
    }
    this.cursorEl.style.display = 'block';
    this.cursorEl.textContent = `${itemDefinition(this.cursorStack.item).name} x${this.cursorStack.count}`;
  }

  private releaseCursor(): void {
    if (this.cursorStack && this.inventory) {
      this.inventory.addItem(this.cursorStack.item, this.cursorStack.count);
    }
    this.cursorStack = null;
    this.paintCursor();
  }
}

function refKey(ref: SlotRef): string {
  if (ref.kind === 'chest') return `chest:${ref.index}`;
  if (ref.kind === 'equip') return `equip:${ref.slot}`;
  return `inv:${ref.index}`;
}

function elementRef(key: string): SlotRef {
  const [kind, value] = key.split(':');
  if (kind === 'chest') return { kind: 'chest', index: Number(value) };
  if (kind === 'equip') return { kind: 'equip', slot: value as EquipmentSlot };
  return { kind: 'inv', index: Number(value) };
}

function slotSig(slot: InventorySlot): string {
  return slot ? `${slot.item}:${slot.count}` : '-';
}

function shortLabel(name: string): string {
  const words = name.split(' ');
  if (words.length > 1)
    return words
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 3);
  return name.slice(0, 3);
}

function equipAbbrev(slot: EquipmentSlot): string {
  switch (slot) {
    case 'helmet':
      return 'HEL';
    case 'chest':
      return 'CHE';
    case 'legs':
      return 'LEG';
    case 'ammo':
      return 'AMM';
  }
}
