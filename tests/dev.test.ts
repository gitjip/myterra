import { describe, expect, it, vi } from 'vitest';
import { completeCommand, runCommand } from '../src/dev/commands';
import type { DevBridge } from '../src/dev/bridge';
import type { CommandOutput } from '../src/dev/commands';
import { EnemyKind } from '../src/data/enemies';
import { ItemId } from '../src/data/items';

function collector(): { out: CommandOutput; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    out: {
      print: (text, error) => {
        if (error) errors.push(text);
        else lines.push(text);
      },
    },
  };
}

function fakeBridge(overrides: Partial<DevBridge> = {}): DevBridge {
  const noop = (): void => undefined;
  return {
    teleport: noop,
    teleportToAim: () => false,
    teleportToSpawn: noop,
    setTimeOfDay: noop,
    advanceDays: noop,
    give: () => 0,
    clearInventory: noop,
    spawnEnemy: () => 0,
    clearEnemies: () => 0,
    clearDrops: () => 0,
    setGod: noop,
    setFlight: noop,
    killPlayer: noop,
    healPlayer: noop,
    fullRelight: noop,
    rebuildLiquid: noop,
    rebuildChunks: noop,
    saveNow: noop,
    seed: () => 42,
    modeName: () => 'survival',
    aim: () => null,
    resetProfiler: noop,
    ...overrides,
  };
}

describe('dev commands', () => {
  it('completes a unique prefix', () => {
    expect(completeCommand('rel')).toBe('relight');
    expect(completeCommand('sp')).toBe('spawn');
    expect(completeCommand('zzz')).toBe('zzz');
  });

  it('prints help without a game and rejects unknown commands', () => {
    const a = collector();
    expect(runCommand('help', null, a.out).handled).toBe(true);
    expect(a.lines.join('\n')).toContain('Commands:');

    const b = collector();
    expect(runCommand('frobnicate', null, b.out).handled).toBe(false);
    expect(b.errors[0]).toContain('unknown');
  });

  it('requires a running game for world commands', () => {
    const capture = collector();
    runCommand('relight', null, capture.out);
    expect(capture.errors.length).toBe(1);
  });

  it('parses give, spawn, tp and time', () => {
    const give = vi.fn(() => 0);
    const spawnEnemy = vi.fn(() => 0);
    const teleport = vi.fn();
    const setTimeOfDay = vi.fn();
    const bridge = fakeBridge({ give, spawnEnemy, teleport, setTimeOfDay });
    const capture = collector();

    runCommand('give stone 5', bridge, capture.out);
    expect(give).toHaveBeenCalledWith(ItemId.Stone, 5);

    runCommand('spawn skeleton 3', bridge, capture.out);
    expect(spawnEnemy).toHaveBeenCalledWith(EnemyKind.Skeleton, 3);

    runCommand('tp 12 -3', bridge, capture.out);
    expect(teleport).toHaveBeenCalledWith(12, -3);

    runCommand('time noon', bridge, capture.out);
    expect(setTimeOfDay).toHaveBeenCalledWith(0.25);
  });

  it('reports a bad item or enemy without calling the bridge', () => {
    const spawnEnemy = vi.fn(() => 0);
    const bridge = fakeBridge({ spawnEnemy });
    const capture = collector();
    runCommand('give nonsense', bridge, capture.out);
    runCommand('spawn dragon', bridge, capture.out);
    expect(spawnEnemy).not.toHaveBeenCalled();
    expect(capture.errors.length).toBe(2);
  });
});
