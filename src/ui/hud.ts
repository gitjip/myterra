import { clamp01 } from '../core/math';
import { itemDefinition } from '../data/items';
import { INVENTORY, SURVIVAL } from '../data/tuning';
import type { Player } from '../entity/player';
import type { Inventory } from '../systems/inventory';

interface Bar {
  readonly fill: HTMLDivElement;
  readonly max: number;
}

const ITEM_NAME_HOLD_SECONDS = 2;
const ITEM_NAME_FADE_SECONDS = 0.5;

/**
 * DOM survival HUD: three stat bars, the hotbar contents and the fading held
 * item name. Styled inline to match the debug overlay until M11 owns the UI.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly health: Bar;
  private readonly hunger: Bar;
  private readonly breath: Bar;
  private readonly slots: HTMLDivElement[] = [];
  private readonly slotLabels: HTMLSpanElement[] = [];
  private readonly slotCounts: HTMLSpanElement[] = [];
  private hotbar: HTMLDivElement | undefined;
  private bars: HTMLDivElement | undefined;
  private readonly itemName: HTMLDivElement;
  private itemNameText = '';
  private itemNameExpiresAt = 0;
  private hotbarSignature = '';

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-hud';

    const bars = document.createElement('div');
    bars.className = 'mt-bars';
    this.health = this.createBar(bars, 'HP', '#e05a5a', SURVIVAL.maxHealth);
    this.hunger = this.createBar(bars, 'FO', '#d9923b', SURVIVAL.maxHunger);
    this.breath = this.createBar(bars, 'BR', '#4aa3e0', SURVIVAL.maxBreath);

    this.itemName = document.createElement('div');
    this.itemName.className = 'mt-item-name';

    const hotbar = document.createElement('div');
    hotbar.className = 'mt-hotbar';
    for (let i = 0; i < INVENTORY.hotbar; i++) {
      const slot = document.createElement('div');
      slot.className = 'mt-hotbar-slot';

      const label = document.createElement('span');
      label.className = 'mt-slot-label';

      const number = document.createElement('span');
      number.textContent = String((i + 1) % 10);
      number.className = 'mt-slot-index';

      const count = document.createElement('span');
      count.className = 'mt-slot-count';

      slot.append(label, number, count);
      hotbar.append(slot);
      this.slots.push(slot);
      this.slotLabels.push(label);
      this.slotCounts.push(count);
    }

    this.root.append(bars, this.itemName, hotbar);
    this.hotbar = hotbar;
    this.bars = bars;
    parent.append(this.root);
  }

  /** Hides the survival bars in creative mode; the hotbar stays. */
  public setSurvival(survival: boolean): void {
    if (this.bars) this.bars.style.display = survival ? 'flex' : 'none';
  }

  /** Hides the hotbar while a full inventory panel is open. */
  public setHotbarVisible(visible: boolean): void {
    if (this.hotbar) this.hotbar.style.display = visible ? 'flex' : 'none';
  }

  /** Shows the held item name, then fades it out. */
  public showItemName(name: string): void {
    this.itemNameText = name;
    this.itemName.textContent = name;
    this.itemNameExpiresAt = performance.now() + ITEM_NAME_HOLD_SECONDS * 1000;
  }

  public update(player: Player, inventory: Inventory): void {
    setBarValue(this.health, player.health);
    setBarValue(this.hunger, player.hunger);
    setBarValue(this.breath, player.breath);

    const signature = this.hotbarSignatureFor(inventory);
    if (signature !== this.hotbarSignature) {
      this.hotbarSignature = signature;
      this.paintHotbar(inventory);
    }

    if (this.itemNameText.length > 0) {
      const remainingMs = this.itemNameExpiresAt - performance.now();
      const opacity = clamp01(remainingMs / (ITEM_NAME_FADE_SECONDS * 1000));
      this.itemName.style.opacity = opacity.toFixed(3);
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private hotbarSignatureFor(inventory: Inventory): string {
    const parts: string[] = [String(inventory.selected)];
    for (let i = 0; i < INVENTORY.hotbar; i++) {
      const slot = inventory.getSlot(i);
      parts.push(slot ? `${slot.item}:${slot.count}` : '-');
    }
    return parts.join('|');
  }

  private paintHotbar(inventory: Inventory): void {
    for (let i = 0; i < INVENTORY.hotbar; i++) {
      const slot = this.slots[i];
      const label = this.slotLabels[i];
      const count = this.slotCounts[i];
      if (!slot || !label || !count) continue;
      const stack = inventory.getSlot(i);
      slot.classList.toggle('mt-hotbar-slot--selected', i === inventory.selected);
      if (stack) {
        label.textContent = shortLabel(itemDefinition(stack.item).name);
        count.textContent = stack.count > 1 ? String(stack.count) : '';
      } else {
        label.textContent = '';
        count.textContent = '';
      }
    }
  }

  private createBar(parent: HTMLElement, label: string, color: string, max: number): Bar {
    const row = document.createElement('div');
    row.className = 'mt-bar-row';

    const text = document.createElement('span');
    text.textContent = label;
    text.className = 'mt-bar-label';

    const track = document.createElement('div');
    track.className = 'mt-bar';

    const fill = document.createElement('div');
    fill.className = 'mt-bar__fill';
    fill.style.background = color;

    track.append(fill);
    row.append(text, track);
    parent.append(row);
    return { fill, max };
  }
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

function setBarValue(bar: Bar, value: number): void {
  const ratio = clamp01(value / bar.max);
  bar.fill.style.width = `${(ratio * 100).toFixed(1)}%`;
}
