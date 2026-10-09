import { describe, expect, it } from 'vitest';
import { buildDevWorldUrl, parseDevWorldParams } from '../src/dev/urlState';

describe('dev world URL', () => {
  it('parses seed, width, mode and player state', () => {
    const params = parseDevWorldParams('?dev=1&seed=123&width=4096&mode=creative&x=10.5&y=-3.2&time=0.75');
    expect(params).toEqual({
      seed: 123,
      reachWidth: 4096,
      mode: 'creative',
      playerX: 10.5,
      playerY: -3.2,
      timeOfDay: 0.75,
    });
  });

  it('returns null without a seed and defaults invalid fields', () => {
    expect(parseDevWorldParams('?dev=1')).toBeNull();
    const params = parseDevWorldParams('?seed=1&width=1&mode=weird&time=9');
    expect(params?.reachWidth).toBe(1024);
    expect(params?.mode).toBe('survival');
    expect(params?.timeOfDay).toBe(1);
  });

  it('round-trips through build', () => {
    const params = {
      seed: 99,
      reachWidth: 2048,
      mode: 'survival' as const,
      playerX: 5,
      playerY: 6,
      timeOfDay: 0.3,
    };
    const url = buildDevWorldUrl('http://x/game', params);
    const search = url.slice(url.indexOf('?'));
    expect(parseDevWorldParams(search)).toEqual(params);
  });
});
