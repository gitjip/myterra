import { clamp01 } from '../core/math';
import { INVENTORY, SURVIVAL } from '../data/tuning';
import type { Player } from '../entity/player';

interface Bar {
  readonly fill: HTMLDivElement;
  readonly max: number;
}

const ITEM_NAME_HOLD_SECONDS = 2;
const ITEM_NAME_FADE_SECONDS = 0.5;

/**
 * DOM survival HUD: three stat bars, a placeholder hotbar and the fading held
 * item name. Styled inline to match the debug overlay and to avoid shipping a
 * stylesheet before M11 owns the real UI.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly health: Bar;
  private readonly hunger: Bar;
  private readonly breath: Bar;
  private readonly slots: HTMLDivElement[] = [];
  private readonly itemName: HTMLDivElement;
  private itemNameText = '';
  private itemNameExpiresAt = 0;
  private selectedSlot = 0;

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      left: '50%',
      bottom: '12px',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      pointerEvents: 'none',
      font: '12px/1.4 ui-monospace, Menlo, Consolas, monospace',
      color: '#d7dceb',
      zIndex: '900',
    } satisfies Partial<CSSStyleDeclaration>);

    const bars = document.createElement('div');
    Object.assign(bars.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.health = this.createBar(bars, 'HP', '#e05a5a', SURVIVAL.maxHealth);
    this.hunger = this.createBar(bars, 'FO', '#d9923b', SURVIVAL.maxHunger);
    this.breath = this.createBar(bars, 'BR', '#4aa3e0', SURVIVAL.maxBreath);

    this.itemName = document.createElement('div');
    Object.assign(this.itemName.style, {
      minHeight: '15px',
      opacity: '0',
      transition: `opacity ${ITEM_NAME_FADE_SECONDS}s linear`,
      textShadow: '0 1px 2px #000',
    } satisfies Partial<CSSStyleDeclaration>);

    const hotbar = document.createElement('div');
    Object.assign(hotbar.style, {
      display: 'flex',
      gap: '4px',
    } satisfies Partial<CSSStyleDeclaration>);
    for (let i = 0; i < INVENTORY.hotbar; i++) {
      const slot = document.createElement('div');
      Object.assign(slot.style, {
        position: 'relative',
        width: '40px',
        height: '40px',
        background: 'rgba(6, 8, 14, 0.6)',
        border: '1px solid #2a2f45',
        borderRadius: '3px',
      } satisfies Partial<CSSStyleDeclaration>);
      const number = document.createElement('span');
      number.textContent = String((i + 1) % 10);
      Object.assign(number.style, {
        position: 'absolute',
        right: '3px',
        bottom: '1px',
        fontSize: '10px',
        color: '#6b7391',
      } satisfies Partial<CSSStyleDeclaration>);
      slot.append(number);
      hotbar.append(slot);
      this.slots.push(slot);
    }

    this.root.append(bars, this.itemName, hotbar);
    parent.append(this.root);
    this.setSelectedSlot(0);
  }

  public setSelectedSlot(index: number): void {
    this.selectedSlot = ((index % INVENTORY.hotbar) + INVENTORY.hotbar) % INVENTORY.hotbar;
    this.slots.forEach((slot, i) => {
      slot.style.borderColor = i === this.selectedSlot ? '#d7dceb' : '#2a2f45';
    });
  }

  public get selected(): number {
    return this.selectedSlot;
  }

  /** Shows the held item name, then fades it out. */
  public showItemName(name: string): void {
    this.itemNameText = name;
    this.itemName.textContent = name;
    this.itemNameExpiresAt = performance.now() + ITEM_NAME_HOLD_SECONDS * 1000;
  }

  public update(player: Player): void {
    setBarValue(this.health, player.health);
    setBarValue(this.hunger, player.hunger);
    setBarValue(this.breath, player.breath);

    if (this.itemNameText.length > 0) {
      const remainingMs = this.itemNameExpiresAt - performance.now();
      const opacity = clamp01(remainingMs / (ITEM_NAME_FADE_SECONDS * 1000));
      this.itemName.style.opacity = opacity.toFixed(3);
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private createBar(parent: HTMLElement, label: string, color: string, max: number): Bar {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    } satisfies Partial<CSSStyleDeclaration>);

    const text = document.createElement('span');
    text.textContent = label;
    Object.assign(text.style, {
      width: '22px',
      color: '#8b93b0',
      fontSize: '10px',
    } satisfies Partial<CSSStyleDeclaration>);

    const track = document.createElement('div');
    Object.assign(track.style, {
      width: '160px',
      height: '10px',
      background: 'rgba(6, 8, 14, 0.72)',
      border: '1px solid #2a2f45',
      borderRadius: '3px',
      overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);

    const fill = document.createElement('div');
    Object.assign(fill.style, {
      width: '100%',
      height: '100%',
      background: color,
    } satisfies Partial<CSSStyleDeclaration>);

    track.append(fill);
    row.append(text, track);
    parent.append(row);
    return { fill, max };
  }
}

function setBarValue(bar: Bar, value: number): void {
  const ratio = clamp01(value / bar.max);
  bar.fill.style.width = `${(ratio * 100).toFixed(1)}%`;
}
