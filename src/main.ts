import { IS_DEV } from './dev/env';
import { Shell } from './ui/shell';
import './ui/styles.css';

function fail(message: string): never {
  document.body.textContent = message;
  throw new Error(message);
}

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) fail('MyTerra: #game canvas is missing from the document.');

const uiRoot = document.querySelector<HTMLDivElement>('#ui');
if (!uiRoot) fail('MyTerra: #ui root is missing from the document.');

const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) fail('MyTerra: could not acquire a 2d canvas context.');

const shell = new Shell(canvas, uiRoot, ctx);

if (IS_DEV) {
  void import('./dev').then((mod) => {
    mod.installDev({ getGame: () => shell.getGame() });
  });
}

// Surfaces anything that escapes instead of failing silently into a black canvas.
window.addEventListener('error', (event) => {
  console.error('[myterra]', event.error ?? event.message);
});

window.addEventListener('beforeunload', () => {
  shell.dispose();
});
