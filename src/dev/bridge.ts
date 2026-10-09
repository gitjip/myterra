import type { EnemyKind } from '../data/enemies';
import type { ItemId } from '../data/items';

/**
 * Narrow surface the dev console uses to drive a running game. Implemented by
 * `Game.devBridge()` so commands never touch private state directly.
 */
export interface DevBridge {
  teleport(x: number, y: number): void;
  teleportToAim(): boolean;
  teleportToSpawn(): void;
  setTimeOfDay(timeOfDay: number): void;
  advanceDays(days: number): void;
  give(item: ItemId, count: number): number;
  clearInventory(): void;
  spawnEnemy(kind: EnemyKind, count: number): number;
  clearEnemies(): number;
  clearDrops(): number;
  setGod(on: boolean): void;
  setFlight(on: boolean): void;
  killPlayer(): void;
  healPlayer(): void;
  fullRelight(): void;
  rebuildLiquid(): void;
  rebuildChunks(): void;
  saveNow(): void;
  seed(): number;
  modeName(): string;
  aim(): { x: number; y: number } | null;
  resetProfiler(): void;
}
