import type { Game } from '../game/game';
import { completeCommand, runCommand } from './commands';
import { ConsolePanel } from './console';
import { IS_DEV } from './env';

/**
 * Handle the dev tooling uses to reach the running game. `getGame` returns null
 * until a world is actually running.
 */
export interface DevContext {
  getGame(): Game | null;
}

let disposeCurrent: (() => void) | null = null;

/** Installs dev-only tooling. No-op outside Dev. */
export function installDev(context: DevContext): () => void {
  if (!IS_DEV) return () => undefined;
  if (disposeCurrent) return disposeCurrent;

  const panel = new ConsolePanel(document.body);
  panel.completer = (prefix) => completeCommand(prefix);
  panel.onCommand = (line) => {
    runCommand(line, context.getGame()?.devBridge() ?? null, {
      print: (text, error) => { panel.print(text, error === true); },
    });
    return null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote') return;
    event.preventDefault();
    panel.toggle();
  };
  window.addEventListener('keydown', onKeyDown);

  const dispose = (): void => {
    window.removeEventListener('keydown', onKeyDown);
    panel.dispose();
    disposeCurrent = null;
  };
  disposeCurrent = dispose;
  return dispose;
}
