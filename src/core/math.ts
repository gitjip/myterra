/** Scalar and rectangle helpers. No allocation unless the name says otherwise. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where `value` sits between `a` and `b`, as 0..1. Returns 0 when a === b. */
export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

export function sign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Move `current` toward `target` by at most `maxDelta`, snapping on arrival. */
export function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + sign(delta) * maxDelta;
}

export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** Always-positive modulo, unlike `%` on negatives. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Round to the nearest multiple of `step`. `step` must be positive. */
export function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function rectRight(r: Rect): number {
  return r.x + r.w;
}

export function rectBottom(r: Rect): number {
  return r.y + r.h;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < rectRight(b) && rectRight(a) > b.x && a.y < rectBottom(b) && rectBottom(a) > b.y;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  );
}

/** Squared distance between two points, in whatever units they are. */
export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Chebyshev (chessboard) distance. Used for entity simulation radii. */
export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Format milliseconds for the debug overlay, e.g. 0.42 -> "0.42". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '--';
  return ms.toFixed(2);
}
