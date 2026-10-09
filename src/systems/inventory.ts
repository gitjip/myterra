import { Emitter } from '../core/emitter';
import { itemDefinition } from '../data/items';
import type { ItemId } from '../data/items';
import { INVENTORY } from '../data/tuning';

export interface ItemStack {
  readonly item: ItemId;
  count: number;
}

export type InventorySlot = ItemStack | null;

export type EquipmentSlot = 'helmet' | 'chest' | 'legs' | 'ammo';
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['helmet', 'chest', 'legs', 'ammo'];

export interface InventoryEvents {
  /** A slot's contents changed. */
  change: number;
  /** The selected hotbar slot changed. */
  select: number;
  /** An equipment slot changed. */
  equipment: EquipmentSlot;
  /** Many slots changed at once (bulk restore); redraw lazily. */
  bulk: undefined;
}

/**
 * Pure item storage: 40 slots with the first 10 acting as the hotbar, plus four
 * equipment slots (helmet / chest / legs / ammo). No weapon slot: weapons are
 * held in the hotbar.
 */
export class Inventory {
  public readonly emitter = new Emitter<InventoryEvents>();
  private readonly slots: InventorySlot[];
  private readonly equipment: InventorySlot[] = EQUIPMENT_SLOTS.map(() => null);
  private selectedIndex = 0;

  public constructor(slotCount: number = INVENTORY.slots) {
    if (slotCount < INVENTORY.hotbar) {
      throw new RangeError(`Inventory needs at least ${INVENTORY.hotbar} slots`);
    }
    this.slots = new Array<InventorySlot>(slotCount).fill(null);
  }

  public get size(): number {
    return this.slots.length;
  }

  public get selected(): number {
    return this.selectedIndex;
  }

  public get selectedSlot(): InventorySlot {
    return this.slots[this.selectedIndex] ?? null;
  }

  public getSlot(index: number): InventorySlot {
    return this.slots[index] ?? null;
  }

  /** Replaces a slot's contents outright (used by bucket fill/pour). */
  public setSlot(index: number, stack: InventorySlot): void {
    if (index < 0 || index >= this.slots.length) return;
    this.slots[index] = stack ? { item: stack.item, count: stack.count } : null;
    this.emitter.emit('change', index);
  }

  public select(index: number): void {
    const wrapped = ((index % INVENTORY.hotbar) + INVENTORY.hotbar) % INVENTORY.hotbar;
    if (wrapped === this.selectedIndex) return;
    this.selectedIndex = wrapped;
    this.emitter.emit('select', wrapped);
  }

  /** Adds items, filling existing stacks first. Returns the leftover that did not fit. */
  public addItem(item: ItemId, count = 1): number {
    if (count <= 0) return 0;
    const max = itemDefinition(item).stackMax;
    let remaining = count;

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.item !== item || slot.count >= max) continue;
      const room = max - slot.count;
      const added = Math.min(room, remaining);
      slot.count += added;
      remaining -= added;
      this.emitter.emit('change', i);
    }

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const added = Math.min(max, remaining);
      this.slots[i] = { item, count: added };
      remaining -= added;
      this.emitter.emit('change', i);
    }

    return remaining;
  }

  /** Removes up to `count` of an item across all slots. Returns how many were removed. */
  public removeItem(item: ItemId, count = 1): number {
    let remaining = count;
    let removed = 0;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.item !== item) continue;
      const take = Math.min(slot.count, remaining);
      removed += this.removeFromSlot(i, take);
      remaining -= take;
    }
    return removed;
  }

  public countOf(item: ItemId): number {
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.item === item) total += slot.count;
    }
    return total;
  }

  public removeFromSlot(index: number, count = 1): number {
    const slot = this.slots[index];
    if (!slot) return 0;
    const take = Math.min(slot.count, count);
    slot.count -= take;
    if (slot.count <= 0) this.slots[index] = null;
    this.emitter.emit('change', index);
    return take;
  }

  /** Splits a stack in half into the first empty slot. Returns false when it cannot. */
  public split(index: number): boolean {
    const slot = this.slots[index];
    if (!slot || slot.count < 2) return false;
    const target = this.slots.findIndex((candidate) => candidate === null);
    if (target < 0) return false;
    const half = Math.floor(slot.count / 2);
    slot.count -= half;
    this.slots[target] = { item: slot.item, count: half };
    this.emitter.emit('change', index);
    this.emitter.emit('change', target);
    return true;
  }

  /** Moves or merges one slot into another, swapping when the items differ. */
  public move(from: number, to: number): void {
    if (from === to) return;
    const source = this.slots[from] ?? null;
    const target = this.slots[to] ?? null;
    if (!source) return;

    if (!target) {
      this.slots[to] = source;
      this.slots[from] = null;
    } else if (target.item === source.item) {
      const max = itemDefinition(source.item).stackMax;
      const room = max - target.count;
      const moved = Math.min(room, source.count);
      target.count += moved;
      source.count -= moved;
      if (source.count <= 0) this.slots[from] = null;
    } else {
      this.slots[from] = target;
      this.slots[to] = source;
    }

    this.emitter.emit('change', from);
    this.emitter.emit('change', to);
  }

  public isEmpty(): boolean {
    return this.slots.every((slot) => slot === null);
  }

  // --- Equipment -----------------------------------------------------------

  public getEquipment(slot: EquipmentSlot): InventorySlot {
    return this.equipment[EQUIPMENT_SLOTS.indexOf(slot)] ?? null;
  }

  public setEquipment(slot: EquipmentSlot, stack: InventorySlot): void {
    this.equipment[EQUIPMENT_SLOTS.indexOf(slot)] = stack
      ? { item: stack.item, count: stack.count }
      : null;
    this.emitter.emit('equipment', slot);
  }

  /** Total armor damage-reduction points from helmet + chest + legs. */
  public armorReduction(): number {
    let total = 0;
    for (const slot of ['helmet', 'chest', 'legs'] as const) {
      const equipped = this.getEquipment(slot);
      if (equipped) total += itemDefinition(equipped.item).armorReduction;
    }
    return total;
  }

  /** Ammo available in the ammo slot. */
  public ammoCount(): number {
    const ammo = this.getEquipment('ammo');
    return ammo && itemDefinition(ammo.item).isAmmo ? ammo.count : 0;
  }

  /** Consumes up to `count` ammo. Returns how many were consumed. */
  public consumeAmmo(count = 1): number {
    const index = EQUIPMENT_SLOTS.indexOf('ammo');
    const ammo = this.equipment[index];
    if (!ammo || !itemDefinition(ammo.item).isAmmo) return 0;
    const take = Math.min(ammo.count, count);
    ammo.count -= take;
    if (ammo.count <= 0) this.equipment[index] = null;
    this.emitter.emit('equipment', 'ammo');
    return take;
  }

  public snapshotEquipment(): InventorySlot[] {
    return this.equipment.map((slot) => (slot ? { item: slot.item, count: slot.count } : null));
  }

  public restoreEquipment(slots: ReadonlyArray<InventorySlot>): void {
    for (let i = 0; i < this.equipment.length; i++) {
      const incoming = slots[i] ?? null;
      this.equipment[i] = incoming ? { item: incoming.item, count: incoming.count } : null;
      this.emitter.emit('equipment', EQUIPMENT_SLOTS[i] ?? 'helmet');
    }
  }

  /** A detached copy of every slot, for saving. */
  public snapshot(): InventorySlot[] {
    return this.slots.map((slot) => (slot ? { item: slot.item, count: slot.count } : null));
  }

  /** Replaces the contents from a save. Extra or missing slots are ignored. */
  public restore(slots: ReadonlyArray<InventorySlot>): void {
    for (let i = 0; i < this.slots.length; i++) {
      const incoming = slots[i] ?? null;
      this.slots[i] = incoming ? { item: incoming.item, count: incoming.count } : null;
    }
    this.emitter.emit('bulk', undefined);
  }
}
