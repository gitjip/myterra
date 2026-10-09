import { WORLD } from '../data/tuning';
import type { ModeName } from '../game/mode';

/** State encoded in a shareable `?seed=...` URL for reproducing a world. */
export interface DevWorldParams {
  readonly seed: number;
  readonly reachWidth: number;
  readonly mode: ModeName;
  readonly playerX?: number;
  readonly playerY?: number;
  readonly timeOfDay?: number;
}

function numberOrUndefined(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function clampWidth(value: number | undefined): number {
  if (value === undefined) return WORLD.defaultReachWidth;
  return Math.min(WORLD.maxReachWidth, Math.max(WORLD.minReachWidth, Math.trunc(value)));
}

/** Parses URL params into a world description, or null when no seed is given. */
export function parseDevWorldParams(search: string): DevWorldParams | null {
  const query = new URLSearchParams(search);
  const seed = numberOrUndefined(query.get('seed'));
  if (seed === undefined) return null;

  const playerX = numberOrUndefined(query.get('x'));
  const playerY = numberOrUndefined(query.get('y'));
  const rawTime = numberOrUndefined(query.get('time'));
  const timeOfDay = rawTime === undefined ? undefined : Math.min(1, Math.max(0, rawTime));
  return {
    seed: seed >>> 0,
    reachWidth: clampWidth(numberOrUndefined(query.get('width'))),
    mode: query.get('mode') === 'creative' ? 'creative' : 'survival',
    ...(playerX !== undefined ? { playerX } : {}),
    ...(playerY !== undefined ? { playerY } : {}),
    ...(timeOfDay !== undefined ? { timeOfDay } : {}),
  };
}

/** Builds a shareable URL that reproduces exactly this world and player state. */
export function buildDevWorldUrl(base: string, params: DevWorldParams): string {
  const query = new URLSearchParams();
  query.set('dev', '1');
  query.set('seed', String(params.seed >>> 0));
  query.set('width', String(params.reachWidth));
  query.set('mode', params.mode);
  if (params.playerX !== undefined) query.set('x', params.playerX.toFixed(1));
  if (params.playerY !== undefined) query.set('y', params.playerY.toFixed(1));
  if (params.timeOfDay !== undefined) query.set('time', params.timeOfDay.toFixed(3));
  return `${base}?${query.toString()}`;
}
