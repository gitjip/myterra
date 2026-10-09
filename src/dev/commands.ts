import { EnemyKind } from '../data/enemies';
import { ItemId, itemDefinition } from '../data/items';
import type { ModeName } from '../game/mode';
import { TEXT } from '../ui/text';
import { buildDevWorldUrl } from './urlState';
import type { DevBridge } from './bridge';

export interface CommandOutput {
  print(text: string, error?: boolean): void;
}

export interface Command {
  readonly name: string;
  readonly help: string;
  run(args: string[], bridge: DevBridge, out: CommandOutput): void;
}

const ALL_ITEMS: ItemId[] = Object.values(ItemId).filter(
  (value): value is ItemId => typeof value === 'number',
);

const ENEMY_KINDS: EnemyKind[] = Object.values(EnemyKind);

function findItem(name: string): ItemId | null {
  const needle = name.toLowerCase();
  let partial: ItemId | null = null;
  for (const item of ALL_ITEMS) {
    const full = itemDefinition(item).name.toLowerCase();
    const compact = full.replace(/\s+/g, '');
    if (full === needle || compact === needle) return item;
    if ((full.startsWith(needle) || compact.startsWith(needle)) && partial === null) partial = item;
  }
  return partial;
}

function parseIntArg(args: string[], index: number, fallback: number): number {
  const raw = args[index];
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function onOff(arg: string | undefined, current: boolean): boolean {
  if (arg === undefined) return !current;
  return arg === 'on' || arg === 'true' || arg === '1';
}

function helpText(): string {
  const list = COMMANDS.map((c) => `  ${c.name.padEnd(12)} ${c.help}`);
  return `Commands:\n${list.join('\n')}`;
}

function commands(): Command[] {
  return [
    {
      name: 'help',
      help: 'list commands',
      run: (_args, _bridge, out) => {
        out.print(helpText());
      },
    },
    {
      name: 'tp',
      help: 'tp <x> <y> | tp aim | tp spawn',
      run: (args, bridge, out) => {
        if (args[0] === 'spawn') {
          bridge.teleportToSpawn();
          out.print('teleported to spawn');
        } else if (args[0] === 'aim') {
          out.print(bridge.teleportToAim() ? 'teleported to cursor' : 'no cursor target');
        } else if (args.length >= 2) {
          bridge.teleport(Number(args[0]), Number(args[1]));
          out.print(`teleported to ${args[0]},${args[1]}`);
        } else {
          out.print('usage: tp <x> <y> | tp aim | tp spawn', true);
        }
      },
    },
    {
      name: 'time',
      help: 'time <0..1> | noon | midnight',
      run: (args, bridge, out) => {
        const key = args[0];
        const value = key === 'noon' ? 0.25 : key === 'midnight' ? 0.75 : Number(key);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          out.print('usage: time <0..1> | noon | midnight', true);
          return;
        }
        bridge.setTimeOfDay(value);
        out.print(`time set to ${value}`);
      },
    },
    {
      name: 'day',
      help: 'advance N days (default 1)',
      run: (args, bridge, out) => {
        const days = parseIntArg(args, 0, 1);
        bridge.advanceDays(days);
        out.print(`advanced ${days} day(s)`);
      },
    },
    {
      name: 'give',
      help: 'give <item> [count]',
      run: (args, bridge, out) => {
        const item = args[0] ? findItem(args[0]) : null;
        if (item === null) {
          out.print(`no such item: ${args[0] ?? ''}`, true);
          return;
        }
        const count = parseIntArg(args, 1, itemDefinition(item).stackMax);
        const leftover = bridge.give(item, count);
        out.print(`gave ${itemDefinition(item).name} x${count - leftover}`);
      },
    },
    {
      name: 'clearinv',
      help: 'empty the inventory',
      run: (_args, bridge, out) => {
        bridge.clearInventory();
        out.print('inventory cleared');
      },
    },
    {
      name: 'spawn',
      help: 'spawn <zombie|slime|skeleton|spider> [count]',
      run: (args, bridge, out) => {
        const requested = (args[0] ?? '').toLowerCase();
        const kind = ENEMY_KINDS.find((candidate) => (candidate as string) === requested);
        if (kind === undefined) {
          out.print(`usage: spawn <${ENEMY_KINDS.join('|')}> [count]`, true);
          return;
        }
        const count = Math.max(1, parseIntArg(args, 1, 1));
        const spawned = bridge.spawnEnemy(kind, count);
        out.print(`spawned ${spawned} ${kind}`);
      },
    },
    {
      name: 'clearenemies',
      help: 'remove all enemies',
      run: (_args, bridge, out) => {
        out.print(`removed ${bridge.clearEnemies()} enemies`);
      },
    },
    {
      name: 'cleardrops',
      help: 'remove all dropped items',
      run: (_args, bridge, out) => {
        out.print(`removed ${bridge.clearDrops()} drops`);
      },
    },
    {
      name: 'god',
      help: 'god [on|off] — toggle invulnerability',
      run: (args, bridge, out) => {
        const on = onOff(args[0], false);
        bridge.setGod(on);
        out.print(`god ${on ? 'on' : 'off'}`);
      },
    },
    {
      name: 'fly',
      help: 'fly [on|off] — toggle creative flight',
      run: (args, bridge, out) => {
        const on = onOff(args[0], false);
        bridge.setFlight(on);
        out.print(`fly ${on ? 'on' : 'off'}`);
      },
    },
    {
      name: 'kill',
      help: 'kill the player',
      run: (_args, bridge, out) => {
        bridge.killPlayer();
        out.print('player killed');
      },
    },
    {
      name: 'heal',
      help: 'restore the player',
      run: (_args, bridge, out) => {
        bridge.healPlayer();
        out.print('player restored');
      },
    },
    {
      name: 'pause',
      help: 'freeze the simulation',
      run: (_args, bridge, out) => {
        bridge.pause();
        out.print('paused');
      },
    },
    {
      name: 'resume',
      help: 'unfreeze the simulation',
      run: (_args, bridge, out) => {
        bridge.resume();
        out.print('running');
      },
    },
    {
      name: 'step',
      help: 'step [n] fixed frames while paused',
      run: (args, bridge, out) => {
        const count = Math.max(1, parseIntArg(args, 0, 1));
        bridge.step(count);
        out.print(`stepping ${count} frame(s)`);
      },
    },
    {
      name: 'frames',
      help: 'print the worst recent frames',
      run: (_args, bridge, out) => {
        out.print(bridge.frameReport());
      },
    },
    {
      name: 'viz',
      help: 'viz list | viz <id> on|off',
      run: (args, bridge, out) => {
        if (args[0] === 'list') {
          out.print(bridge.listLayers());
          return;
        }
        const id = args[0];
        if (id === undefined) {
          out.print('usage: viz list | viz <id> on|off', true);
          return;
        }
        const on = args[1] === 'on' || args[1] === '1' || args[1] === 'true';
        const ok = bridge.setLayer(id, on);
        out.print(ok ? `${id} ${on ? 'on' : 'off'}` : `unknown layer: ${id}`, !ok);
      },
    },
    {
      name: 'seed',
      help: 'print the world seed',
      run: (_args, bridge, out) => {
        out.print(`seed ${bridge.seed()}  mode ${bridge.modeName()}`);
      },
    },
    {
      name: 'url',
      help: 'print a shareable URL reproducing this world',
      run: (_args, bridge, out) => {
        const position = bridge.playerPos();
        const base =
          typeof location === 'undefined' ? 'http://localhost/' : `${location.origin}${location.pathname}`;
        out.print(
          buildDevWorldUrl(base, {
            seed: bridge.seed(),
            reachWidth: bridge.reachWidth(),
            mode: bridge.modeName() as ModeName,
            playerX: position.x,
            playerY: position.y,
            timeOfDay: bridge.timeOfDayValue(),
          }),
        );
      },
    },
    {
      name: 'relight',
      help: 'recompute all lighting',
      run: (_args, bridge, out) => {
        bridge.fullRelight();
        out.print('lighting recomputed');
      },
    },
    {
      name: 'rebuild',
      help: 'rebuild liquid queue and chunk cache',
      run: (_args, bridge, out) => {
        bridge.rebuildLiquid();
        bridge.rebuildChunks();
        out.print('liquid and chunks rebuilt');
      },
    },
    {
      name: 'save',
      help: 'save the world now',
      run: (_args, bridge, out) => {
        bridge.saveNow();
        out.print('save requested');
      },
    },
    {
      name: 'profiler',
      help: 'profiler reset — clear timing windows',
      run: (args, bridge, out) => {
        if (args[0] === 'reset') {
          bridge.resetProfiler();
          out.print('profiler cleared');
        } else {
          out.print('usage: profiler reset', true);
        }
      },
    },
  ];
}

export const COMMANDS: Command[] = commands();

const BY_NAME = new Map(COMMANDS.map((command) => [command.name, command]));

export interface CommandResult {
  /** Prints the result; returns false when the command was unknown. */
  readonly handled: boolean;
}

/** Runs one console line. Returns false when the command name is unknown. */
export function runCommand(
  line: string,
  bridge: DevBridge | null,
  out: CommandOutput,
): CommandResult {
  const parts = line.trim().split(/\s+/);
  const name = parts[0] ?? '';
  if (name === 'help') {
    out.print(helpText());
    return { handled: true };
  }
  const command = BY_NAME.get(name);
  if (!command) {
    out.print(`${TEXT.dev.unknown}: ${name}`, true);
    return { handled: false };
  }
  if (!bridge) {
    out.print(TEXT.dev.noGame, true);
    return { handled: true };
  }
  command.run(parts.slice(1), bridge, out);
  return { handled: true };
}

/** Longest command name matching a prefix, for Tab completion. */
export function completeCommand(prefix: string): string {
  const needle = prefix.trim();
  if (needle.length === 0) return prefix;
  for (const command of COMMANDS) {
    if (command.name.startsWith(needle)) return command.name;
  }
  return prefix;
}
