import type { Game } from '../game/game';
import { IS_DEV } from './env';

/**
 * Handle the dev tooling uses to reach the running game. `getGame` returns null
 * until a world is actually running.
 */
export interface DevContext {
  getGame(): Game | null;
}

let installed = false;

/** Installs dev-only tooling. No-op outside Dev. */
export function installDev(_context: DevContext): () => void {
  if (!IS_DEV || installed) return () => undefined;
  installed = true;
  return () => {
    installed = false;
  };
}
