import type { ItemId } from '../data/items';
import { GEN } from '../data/tuning';
import type { World } from '../world/world';
import { decodeLiquidDiff, decodeTileDiff, encodeLiquidDiff, encodeTileDiff } from './diff';
import {
  ByteReader,
  ByteWriter,
  readHeader,
  SECTION,
  SAVE_VERSION,
  writeHeader,
  writeSection,
} from './format';
import type { SaveHeader } from './format';

/** Local mode name to keep the save layer independent of the game layer. */
export type SaveModeName = 'survival' | 'creative';

export interface SavePlayer {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly health: number;
  readonly hunger: number;
  readonly breath: number;
  readonly facing: number;
}

export interface SaveStack {
  readonly item: ItemId;
  readonly count: number;
}

export interface SaveInventory {
  readonly slots: ReadonlyArray<SaveStack | null>;
  readonly equipment: ReadonlyArray<SaveStack | null>;
}

export interface SaveState {
  readonly world: World;
  readonly seed: number;
  readonly mode: SaveModeName;
  readonly timeOfDay: number;
  readonly dayCount: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly createdAt: number;
  readonly playedMs: number;
  readonly player: SavePlayer;
  readonly inventory: SaveInventory;
}

export interface LoadedState {
  readonly mode: SaveModeName;
  readonly timeOfDay: number;
  readonly dayCount: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly createdAt: number;
  readonly playedMs: number;
  readonly player: SavePlayer | null;
  readonly inventory: SaveInventory | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

/** Serialises a world snapshot into the sectioned save format. */
export function encodeSave(state: SaveState): Uint8Array {
  const header: SaveHeader = {
    version: SAVE_VERSION,
    genVersion: GEN.genVersion,
    seed: state.seed,
    width: state.world.width,
    yMin: state.world.yMin,
    yMax: state.world.yMax,
    mode: state.mode === 'creative' ? 1 : 0,
    timeOfDay: state.timeOfDay,
    dayCount: state.dayCount,
    spawnX: state.spawnX,
    spawnY: state.spawnY,
    createdAt: state.createdAt,
    playedMs: state.playedMs,
  };

  const writer = new ByteWriter();
  writeHeader(writer, header);
  writeSection(writer, SECTION.TileDiff, encodeTileDiff(state.world));
  writeSection(writer, SECTION.LiquidDiff, encodeLiquidDiff(state.world));
  writeSection(writer, SECTION.Player, jsonBytes(state.player));
  writeSection(writer, SECTION.Inventory, jsonBytes(state.inventory));
  writeSection(writer, SECTION.Stats, jsonBytes({ playedMs: state.playedMs, mode: state.mode }));
  return writer.toBytes();
}

/** Reads only the header. Used to validate a stored slot before applying it. */
export function readSaveHeader(bytes: Uint8Array): SaveHeader {
  return readHeader(new ByteReader(bytes));
}

/** Applies a save on top of a freshly generated world. Throws a readable error. */
export function applySave(world: World, bytes: Uint8Array): LoadedState {
  const reader = new ByteReader(bytes);
  const header = readHeader(reader);
  if (header.genVersion !== GEN.genVersion) {
    throw new Error(
      `MyTerra save: world generator version mismatch (save ${header.genVersion}, current ${GEN.genVersion})`,
    );
  }
  if (header.width !== world.width) {
    throw new Error(
      `MyTerra save: world width mismatch (save ${header.width}, world ${world.width})`,
    );
  }

  let player: SavePlayer | null = null;
  let inventory: SaveInventory | null = null;

  world.beginBulk();
  try {
    while (reader.remaining > 0) {
      const tag = reader.u8();
      const length = reader.u32();
      const payload = reader.slice(length);
      switch (tag) {
        case SECTION.TileDiff:
          decodeTileDiff(world, payload);
          break;
        case SECTION.LiquidDiff:
          decodeLiquidDiff(world, payload);
          break;
        case SECTION.Player:
          player = JSON.parse(decoder.decode(payload)) as SavePlayer;
          break;
        case SECTION.Inventory:
          inventory = JSON.parse(decoder.decode(payload)) as SaveInventory;
          break;
        default:
          // Unknown sections are ignored so newer saves degrade gracefully.
          break;
      }
    }
  } finally {
    world.endBulk();
  }

  return {
    mode: header.mode === 1 ? 'creative' : 'survival',
    timeOfDay: header.timeOfDay,
    dayCount: header.dayCount,
    spawnX: header.spawnX,
    spawnY: header.spawnY,
    createdAt: header.createdAt,
    playedMs: header.playedMs,
    player,
    inventory,
  };
}
