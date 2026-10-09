/**
 * Procedural pixel-art panel skin, generated at runtime so the build ships no
 * images. Applied through a CSS variable consumed by `.mt-panel` when the
 * `mt-skin` body class is set.
 */
let cached: string | null = null;

const SIZE = 24;
const SLICE = 8;

function generate(): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;

  // Outer border, inner highlight, then a darker recessed face.
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#3a415c';
  ctx.fillRect(1, 1, SIZE - 2, SIZE - 2);
  ctx.fillStyle = '#141926';
  ctx.fillRect(3, 3, SIZE - 6, SIZE - 6);

  // Corner notches for a chunky pixel feel.
  ctx.fillStyle = '#2a2f45';
  for (const [x, y] of [
    [0, 0],
    [SIZE - 3, 0],
    [0, SIZE - 3],
    [SIZE - 3, SIZE - 3],
  ] as const) {
    ctx.fillRect(x, y, 3, 3);
  }
  return canvas.toDataURL('image/png');
}

/** Toggles the pixel skin. Generates the texture lazily on first enable. */
export function applyPixelSkin(on: boolean): void {
  if (typeof document === 'undefined') return;
  if (!on) {
    document.body.classList.remove('mt-skin');
    return;
  }
  if (cached === null) cached = generate();
  document.documentElement.style.setProperty('--mt-skin', `url(${cached})`);
  document.documentElement.style.setProperty('--mt-skin-slice', `${SLICE}`);
  document.body.classList.add('mt-skin');
}
