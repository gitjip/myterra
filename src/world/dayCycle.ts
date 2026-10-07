import { clamp01, lerp } from '../core/math';
import { LIGHT } from '../data/tuning';

export interface DayAdvance {
  readonly timeOfDay: number;
  readonly dayCount: number;
}

/** Advances the clock, wrapping at midnight. */
export function advanceDay(timeOfDay: number, dayCount: number, dt: number): DayAdvance {
  let t = timeOfDay + dt / LIGHT.dayCycleSeconds;
  let days = dayCount;
  while (t >= 1) {
    t -= 1;
    days++;
  }
  return { timeOfDay: t, dayCount: days };
}

/** 1 at noon (0.25), 0 at midnight (0.75). Dawn/dusk sit near 0.5. */
export function daylight(timeOfDay: number): number {
  return clamp01((Math.cos((timeOfDay - 0.25) * Math.PI * 2) + 1) / 2);
}

export function dayFactorFor(timeOfDay: number): number {
  return lerp(LIGHT.dayFactorNight, LIGHT.dayFactorDay, daylight(timeOfDay));
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const NIGHT: Rgb = { r: 11, g: 15, b: 30 };
const DAY: Rgb = { r: 135, g: 184, b: 216 };
const TWILIGHT: Rgb = { r: 217, g: 138, b: 90 };

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Sky colour: night, day and a warm tint at the dawn/dusk crossover. */
export function skyColorFor(timeOfDay: number): Rgb {
  const d = daylight(timeOfDay);
  const base = mix(NIGHT, DAY, d);
  const twilight = clamp01(1 - Math.abs(d - 0.5) * 2) * 0.6;
  return mix(base, TWILIGHT, twilight);
}

export function cssColor(color: Rgb): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}
