import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/game/keymap';
import {
  DEFAULT_KEYMAP,
  KEYMAP_STORAGE_KEY,
  decodeKeymap,
  loadKeymap,
  remap,
  saveKeymap,
} from '../src/game/keymap';

class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('keymap', () => {
  it('falls back to the defaults for missing or corrupt storage', () => {
    expect(decodeKeymap(null)).toEqual(DEFAULT_KEYMAP);
    expect(decodeKeymap('not json')).toEqual(DEFAULT_KEYMAP);
    expect(decodeKeymap('{"left":"KeyQ"}')).toEqual(DEFAULT_KEYMAP);
  });

  it('accepts per-action overrides and keeps the rest default', () => {
    const map = decodeKeymap('{"left":["KeyQ"]}');
    expect(map.left).toEqual(['KeyQ']);
    expect(map.right).toEqual(DEFAULT_KEYMAP.right);
  });

  it('round-trips through a key-value store', () => {
    const store = new MemoryStore();
    saveKeymap(remap(DEFAULT_KEYMAP, 'jump', 'KeyZ'), store);
    expect(store.getItem(KEYMAP_STORAGE_KEY)).not.toBeNull();
    expect(loadKeymap(store).jump).toEqual(['KeyZ']);
  });

  it('unbinds a key from every other action when remapping', () => {
    const map = remap(DEFAULT_KEYMAP, 'jump', 'KeyA');
    expect(map.jump).toEqual(['KeyA']);
    expect(map.left).not.toContain('KeyA');
  });
});
