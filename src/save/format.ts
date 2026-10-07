/**
 * Low-level save primitives: little-endian byte access, varints, section
 * framing and the fixed header. Payload codecs live in diff.ts.
 */

export const SAVE_MAGIC = 0x5254594d; // 'MYTR'
export const SAVE_VERSION = 1;

export const SECTION = {
  TileDiff: 0x01,
  LiquidDiff: 0x02,
  Player: 0x10,
  Inventory: 0x11,
  Stats: 0x13,
} as const;

export class ByteWriter {
  private buffer = new ArrayBuffer(1024);
  private view = new DataView(this.buffer);
  private length = 0;

  public u8(value: number): void {
    this.ensure(1);
    this.view.setUint8(this.length, value & 0xff);
    this.length += 1;
  }

  public u16(value: number): void {
    this.ensure(2);
    this.view.setUint16(this.length, value & 0xffff, true);
    this.length += 2;
  }

  public u32(value: number): void {
    this.ensure(4);
    this.view.setUint32(this.length, value >>> 0, true);
    this.length += 4;
  }

  public i32(value: number): void {
    this.ensure(4);
    this.view.setInt32(this.length, value | 0, true);
    this.length += 4;
  }

  public f32(value: number): void {
    this.ensure(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
  }

  public f64(value: number): void {
    this.ensure(8);
    this.view.setFloat64(this.length, value, true);
    this.length += 8;
  }

  public raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    new Uint8Array(this.buffer).set(bytes, this.length);
    this.length += bytes.length;
  }

  public get size(): number {
    return this.length;
  }

  public toBytes(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.length).slice();
  }

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.byteLength) return;
    let capacity = this.buffer.byteLength * 2;
    while (capacity < this.length + extra) capacity *= 2;
    const next = new ArrayBuffer(capacity);
    new Uint8Array(next).set(new Uint8Array(this.buffer, 0, this.length));
    this.buffer = next;
    this.view = new DataView(next);
  }
}

export class ByteReader {
  private readonly view: DataView;
  private offset = 0;

  public constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  public get position(): number {
    return this.offset;
  }

  public get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  public u8(): number {
    this.require(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  public u16(): number {
    this.require(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  public u32(): number {
    this.require(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public i32(): number {
    this.require(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public f32(): number {
    this.require(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public f64(): number {
    this.require(8);
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  public slice(length: number): Uint8Array {
    this.require(length);
    const out = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  private require(length: number): void {
    if (this.offset + length > this.bytes.byteLength) {
      throw new Error('MyTerra save: truncated data');
    }
  }
}

export function writeVarint(writer: ByteWriter, value: number): void {
  let remaining = value >>> 0;
  while (remaining >= 0x80) {
    writer.u8((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  writer.u8(remaining);
}

export function readVarint(reader: ByteReader): number {
  let result = 0;
  let shift = 0;
  for (let i = 0; i < 5; i++) {
    const byte = reader.u8();
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
  throw new Error('MyTerra save: varint too long');
}

export interface SaveHeader {
  readonly version: number;
  readonly genVersion: number;
  readonly seed: number;
  readonly width: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly mode: number;
  readonly timeOfDay: number;
  readonly dayCount: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly createdAt: number;
  readonly playedMs: number;
}

export function writeHeader(writer: ByteWriter, header: SaveHeader): void {
  writer.u32(SAVE_MAGIC);
  writer.u16(header.version);
  writer.u16(header.genVersion);
  writer.u32(header.seed);
  writer.u32(header.width);
  writer.i32(header.yMin);
  writer.i32(header.yMax);
  writer.u8(header.mode);
  writer.f32(header.timeOfDay);
  writer.u32(header.dayCount);
  writer.i32(header.spawnX);
  writer.i32(header.spawnY);
  writer.f64(header.createdAt);
  writer.f64(header.playedMs);
}

export function readHeader(reader: ByteReader): SaveHeader {
  const magic = reader.u32();
  if (magic !== SAVE_MAGIC) throw new Error('MyTerra save: bad magic');
  const version = reader.u16();
  if (version !== SAVE_VERSION) {
    throw new Error(`MyTerra save: unsupported save version ${version}`);
  }
  return {
    version,
    genVersion: reader.u16(),
    seed: reader.u32(),
    width: reader.u32(),
    yMin: reader.i32(),
    yMax: reader.i32(),
    mode: reader.u8(),
    timeOfDay: reader.f32(),
    dayCount: reader.u32(),
    spawnX: reader.i32(),
    spawnY: reader.i32(),
    createdAt: reader.f64(),
    playedMs: reader.f64(),
  };
}

/** Frames a section as `tag u8 + length u32 + payload`. */
export function writeSection(writer: ByteWriter, tag: number, payload: Uint8Array): void {
  writer.u8(tag);
  writer.u32(payload.length);
  writer.raw(payload);
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
