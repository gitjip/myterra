import { describe, expect, it } from 'vitest';
import { CREATIVE, MODE, Mode, SURVIVAL } from '../src/game/mode';

describe('mode', () => {
  it('exposes the documented presets', () => {
    expect(SURVIVAL.canFly).toBe(false);
    expect(SURVIVAL.instantMine).toBe(false);
    expect(SURVIVAL.infinitePlace).toBe(false);
    expect(SURVIVAL.hasHunger).toBe(true);
    expect(SURVIVAL.takeDamage).toBe(true);

    expect(CREATIVE.canFly).toBe(true);
    expect(CREATIVE.instantMine).toBe(true);
    expect(CREATIVE.infinitePlace).toBe(true);
    expect(CREATIVE.infiniteItems).toBe(true);
    expect(CREATIVE.hasHunger).toBe(false);
    expect(CREATIVE.takeDamage).toBe(false);
  });

  it('replaces the flag set reference on switch', () => {
    const mode = new Mode();
    expect(mode.name).toBe('survival');
    const before = mode.flags;
    mode.set('creative');
    expect(mode.flags).toBe(CREATIVE);
    expect(mode.flags).not.toBe(before);
    expect(mode.toggle()).toBe('survival');
    expect(mode.flags).toBe(SURVIVAL);
  });

  it('keeps the MODE record pointing at the presets', () => {
    expect(MODE.survival).toBe(SURVIVAL);
    expect(MODE.creative).toBe(CREATIVE);
  });
});
