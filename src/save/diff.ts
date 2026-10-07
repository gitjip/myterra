import { tileIdFromByte } from '../data/tiles';
import type { World } from '../world/world';
import { liquidTypeFromByte } from '../world/world';
import { ByteReader, ByteWriter, concatBytes, readVarint, writeVarint } from './format';

const MAX_RUN = 255;

function encodeRuns(
  world: World,
  isDirty: (index: number) => boolean,
  writeCell: (index: number, writer: ByteWriter) => void,
): Uint8Array {
  const cells = world.width * world.height;
  const runs: Uint8Array[] = [];
  let first = -1;
  let previousEnd = 0;
  let i = 0;

  while (i < cells) {
    if (!isDirty(i)) {
      i++;
      continue;
    }
    if (first < 0) {
      first = i;
      previousEnd = i;
    }
    const start = i;
    const gap = start - previousEnd + 1;

    const cellWriter = new ByteWriter();
    let length = 0;
    while (i < cells && length < MAX_RUN && isDirty(i)) {
      writeCell(i, cellWriter);
      length++;
      i++;
    }
    previousEnd = start + length - 1;

    const run = new ByteWriter();
    writeVarint(run, gap);
    run.u8(length);
    run.raw(cellWriter.toBytes());
    runs.push(run.toBytes());
  }

  const out = new ByteWriter();
  out.u32(first < 0 ? 0 : first);
  out.u32(runs.length);
  return concatBytes([out.toBytes(), ...runs]);
}

export function encodeTileDiff(world: World): Uint8Array {
  return encodeRuns(
    world,
    (index) => world.isTileDirty(index),
    (index, writer) => {
      writer.u8(world.fg[index] ?? 0);
    },
  );
}

export function encodeLiquidDiff(world: World): Uint8Array {
  return encodeRuns(
    world,
    (index) => world.isLiquidDirty(index),
    (index, writer) => {
      writer.u8(world.liquidType[index] ?? 0);
      writer.u8(world.liquidAmount[index] ?? 0);
    },
  );
}

function cellCoords(world: World, index: number): { x: number; y: number } {
  return {
    x: world.xMin + (index % world.width),
    y: world.yMin + Math.floor(index / world.width),
  };
}

export function decodeTileDiff(world: World, bytes: Uint8Array): number {
  const reader = new ByteReader(bytes);
  const first = reader.u32();
  const runCount = reader.u32();
  const cells = world.width * world.height;
  let cursor = first;
  let applied = 0;

  for (let run = 0; run < runCount; run++) {
    const gap = readVarint(reader);
    const length = reader.u8();
    const start = cursor + gap - 1;
    for (let k = 0; k < length; k++) {
      const index = start + k;
      if (index < 0 || index >= cells) throw new Error('MyTerra save: tile index out of range');
      const { x, y } = cellCoords(world, index);
      world.setTile(x, y, tileIdFromByte(reader.u8()));
      applied++;
    }
    cursor = start + length - 1;
  }
  return applied;
}

export function decodeLiquidDiff(world: World, bytes: Uint8Array): number {
  const reader = new ByteReader(bytes);
  const first = reader.u32();
  const runCount = reader.u32();
  const cells = world.width * world.height;
  let cursor = first;
  let applied = 0;

  for (let run = 0; run < runCount; run++) {
    const gap = readVarint(reader);
    const length = reader.u8();
    const start = cursor + gap - 1;
    for (let k = 0; k < length; k++) {
      const index = start + k;
      if (index < 0 || index >= cells) {
        throw new Error('MyTerra save: liquid index out of range');
      }
      const { x, y } = cellCoords(world, index);
      const type = liquidTypeFromByte(reader.u8());
      const amount = reader.u8();
      world.setLiquid(x, y, type, amount);
      applied++;
    }
    cursor = start + length - 1;
  }
  return applied;
}
