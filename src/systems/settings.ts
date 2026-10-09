import { ENTITY, FRAME_BUDGET_MS, RENDER } from '../data/tuning';

/** Runtime settings, persisted to localStorage. All values are clamped. */
export interface Settings {
  /** Tiles drawn each side of the camera centre. */
  renderDistance: number;
  /** Chebyshev radius for entity simulation / spawning, in tiles. */
  simulationDistance: number;
  liquidBudgetMs: number;
  sandBudgetMs: number;
  lightBudgetMs: number;
  resolutionScale: number;
  uiScale: number;
  showOverlay: boolean;
}

export const SETTINGS_STORAGE_KEY = 'myterra.settings';

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 96,
  simulationDistance: ENTITY.simulateRadius,
  liquidBudgetMs: FRAME_BUDGET_MS.liquid,
  sandBudgetMs: FRAME_BUDGET_MS.sand,
  lightBudgetMs: FRAME_BUDGET_MS.light,
  resolutionScale: RENDER.defaultResolutionScale,
  uiScale: RENDER.defaultUiScale,
  showOverlay: false,
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampSetting(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeSettings(raw: unknown): Settings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (key: string, min: number, max: number, fallback: number): number => {
    const value = source[key];
    return typeof value === 'number' ? clampSetting(value, min, max, fallback) : fallback;
  };
  return {
    renderDistance: num('renderDistance', 16, 256, DEFAULT_SETTINGS.renderDistance),
    simulationDistance: num('simulationDistance', 32, 256, DEFAULT_SETTINGS.simulationDistance),
    liquidBudgetMs: num('liquidBudgetMs', 0.5, 8, DEFAULT_SETTINGS.liquidBudgetMs),
    sandBudgetMs: num('sandBudgetMs', 0.5, 8, DEFAULT_SETTINGS.sandBudgetMs),
    lightBudgetMs: num('lightBudgetMs', 0.5, 8, DEFAULT_SETTINGS.lightBudgetMs),
    resolutionScale: num(
      'resolutionScale',
      RENDER.minResolutionScale,
      RENDER.maxResolutionScale,
      1,
    ),
    uiScale: num('uiScale', RENDER.minUiScale, RENDER.maxUiScale, 1),
    showOverlay: source['showOverlay'] === true,
  };
}

export function loadSettings(storage?: KeyValueStore | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage?: KeyValueStore | null): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable; the in-memory settings still apply.
  }
}
