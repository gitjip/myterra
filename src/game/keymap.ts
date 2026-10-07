import { INPUT } from '../data/tuning';

/** Remappable actions. Zoom, overlay and fullscreen stay fixed for now. */
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump';

export type KeyMap = Record<Action, readonly string[]>;

export const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'jump'];

export const DEFAULT_KEYMAP: KeyMap = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
};

export const KEYMAP_STORAGE_KEY = INPUT.storageKey;

/** The slice of the Storage API the keymap needs, so tests can pass a stub. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function cloneKeymap(map: KeyMap): KeyMap {
  return {
    left: [...map.left],
    right: [...map.right],
    up: [...map.up],
    down: [...map.down],
    jump: [...map.jump],
  };
}

export function isActionBound(map: KeyMap, action: Action, code: string): boolean {
  return map[action].includes(code);
}

/** Parses a stored map, falling back per-action to the defaults on any garbage. */
export function decodeKeymap(raw: string | null): KeyMap {
  const result = cloneKeymap(DEFAULT_KEYMAP);
  if (!raw) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (typeof parsed !== 'object' || parsed === null) return result;

  const source = parsed as Record<string, unknown>;
  for (const action of ACTIONS) {
    const value = source[action];
    if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
      result[action] = value;
    }
  }
  return result;
}

export function loadKeymap(storage?: KeyValueStore | null): KeyMap {
  if (!storage) return cloneKeymap(DEFAULT_KEYMAP);
  return decodeKeymap(storage.getItem(KEYMAP_STORAGE_KEY));
}

export function saveKeymap(map: KeyMap, storage?: KeyValueStore | null): void {
  if (!storage) return;
  try {
    storage.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode / quota); the in-memory map still works.
  }
}

/** Rebinds `action` to a single key, removing that key from any other action. */
export function remap(map: KeyMap, action: Action, code: string): KeyMap {
  const next = cloneKeymap(map);
  for (const other of ACTIONS) {
    next[other] = next[other].filter((bound) => bound !== code);
  }
  next[action] = [code];
  return next;
}
