import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from '../src/systems/settings';
import type { KeyValueStore } from '../src/systems/settings';
import { craft } from '../src/systems/crafting';
import { RECIPES } from '../src/data/recipes';
import { ItemId } from '../src/data/items';
import { Inventory } from '../src/systems/inventory';

class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('settings', () => {
  it('clamps out-of-range values into their valid ranges', () => {
    const settings = sanitizeSettings({
      renderDistance: 9999,
      simulationDistance: -10,
      liquidBudgetMs: 0,
      uiScale: 5,
    });
    expect(settings.renderDistance).toBe(256);
    expect(settings.simulationDistance).toBe(32);
    expect(settings.liquidBudgetMs).toBe(0.5);
    expect(settings.uiScale).toBe(2);
    expect(settings.showOverlay).toBe(false);
  });

  it('falls back to defaults for missing or corrupt storage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const store = new MemoryStore();
    store.setItem('myterra.settings', 'not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through storage', () => {
    const store = new MemoryStore();
    const custom = { ...DEFAULT_SETTINGS, renderDistance: 48, uiScale: 1.5, showOverlay: true };
    saveSettings(custom, store);
    expect(loadSettings(store)).toEqual(custom);
  });

  it('crafts without consuming inputs when free (creative)', () => {
    const inventory = new Inventory();
    const recipe = RECIPES.find((r) => r.output === ItemId.Workbench);
    if (!recipe) throw new Error('missing recipe');
    expect(craft(recipe, inventory, true)).toBe(true);
    expect(inventory.countOf(ItemId.Workbench)).toBe(1);
    expect(inventory.countOf(ItemId.Wood)).toBe(0);
  });
});
