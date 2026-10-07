import { rectsOverlap } from '../core/math';
import type { Footprint, ItemId } from '../data/items';
import { dropForTile, itemDefinition, toolClassOf, toolTierOf } from '../data/items';
import { isDoorTile, tileDefinition, TileId, WallId } from '../data/tiles';
import type { ToolClass } from '../data/tiles';
import { INTERACTION, MINING } from '../data/tuning';
import { doorStateAt, toggleDoor } from '../entity/door';
import type { Inventory } from './inventory';
import type { Body } from './physics';
import type { World } from '../world/world';

export interface MiningProfile {
  readonly minable: boolean;
  readonly multiplier: number;
  readonly drops: boolean;
}

export interface PlaceCheck {
  readonly ok: boolean;
  readonly reason: string;
}

export interface BreakEvent {
  readonly x: number;
  readonly y: number;
  readonly tile: TileId;
  readonly drop: ItemId | null;
}

export interface InteractionInput {
  readonly tileX: number;
  readonly tileY: number;
  readonly hasTarget: boolean;
  /** Left mouse held. */
  readonly mine: boolean;
  /** Right mouse went down this step. */
  readonly placePressed: boolean;
  /** Right mouse is held. */
  readonly placeHeld: boolean;
  readonly dt: number;
  /** Creative: break instantly, ignoring tool requirements. */
  readonly instantMine?: boolean;
  /** Creative: do not consume the placed item. */
  readonly infinitePlace?: boolean;
  /** Creative sandbox: place this raw tile instead of the held item. */
  readonly paletteTile?: TileId | null;
}

/**
 * Mining and placing rules. Everything here is pure so the rule tables can be
 * tested directly; the controller below just adds targeting and progress.
 */
export function miningProfile(tile: TileId, heldTool: ToolClass | null): MiningProfile {
  const def = tileDefinition(tile);
  if (def.unbreakable || tile === TileId.Air) {
    return { minable: false, multiplier: 1, drops: false };
  }
  if (def.requiresTool && heldTool === null) {
    return { minable: false, multiplier: 1, drops: false };
  }
  const wrong = def.tool !== null && heldTool !== null && heldTool !== def.tool;
  return { minable: true, multiplier: wrong ? INTERACTION.wrongToolMultiplier : 1, drops: !wrong };
}

export function mineSeconds(tile: TileId, heldTool: ToolClass | null, tier = 1): number {
  const profile = miningProfile(tile, heldTool);
  if (!profile.minable) return Number.POSITIVE_INFINITY;
  const speed = MINING.tierSpeed[tier] ?? 1;
  return Math.max(
    MINING.minSeconds,
    tileDefinition(tile).hardness * MINING.secondsPerHardness * profile.multiplier * speed,
  );
}

/** Rectangular reach: the player's tile bounds expanded by INTERACTION.reach. */
export function withinReach(body: Body, tileX: number, tileY: number): boolean {
  const minX = Math.floor(body.x) - INTERACTION.reach;
  const maxX = Math.floor(body.x + body.w - 1e-6) + INTERACTION.reach;
  const minY = Math.floor(body.y) - INTERACTION.reach;
  const maxY = Math.floor(body.y + body.h - 1e-6) + INTERACTION.reach;
  return tileX >= minX && tileX <= maxX && tileY >= minY && tileY <= maxY;
}

function isAir(world: World, x: number, y: number): boolean {
  return world.getTile(x, y) === TileId.Air;
}

function overlapsBody(body: Body, x: number, y: number): boolean {
  return rectsOverlap(body, { x, y, w: 1, h: 1 });
}

/** A torch needs an adjacent solid tile or any background wall. */
export function hasSupport(world: World, x: number, y: number): boolean {
  if (world.getWall(x, y) !== WallId.None) return true;
  return (
    world.isSolid(x - 1, y) ||
    world.isSolid(x + 1, y) ||
    world.isSolid(x, y - 1) ||
    world.isSolid(x, y + 1)
  );
}

export interface PlaceSpec {
  /** Tile written by a one-cell placement, or null for doors. */
  readonly tile: TileId | null;
  readonly footprint: Footprint;
  readonly requiresSupport: boolean;
  readonly isDoor: boolean;
}

const UNIT_FOOTPRINT: Footprint = { w: 1, h: 1 };

export function specForItem(item: ItemId): PlaceSpec {
  const def = itemDefinition(item);
  return {
    tile: def.tile,
    footprint: def.footprint,
    requiresSupport: def.requiresSupport,
    isDoor: def.isDoor,
  };
}

export function specForTile(tile: TileId): PlaceSpec {
  if (isDoorTile(tile)) {
    return { tile: null, footprint: { w: 1, h: 2 }, requiresSupport: false, isDoor: true };
  }
  return {
    tile,
    footprint: UNIT_FOOTPRINT,
    requiresSupport: tile === TileId.Torch,
    isDoor: false,
  };
}

export function canPlaceSpec(
  world: World,
  body: Body,
  spec: PlaceSpec,
  x: number,
  y: number,
): PlaceCheck {
  if (spec.tile === null && !spec.isDoor) return { ok: false, reason: 'not placeable' };
  if (!withinReach(body, x, y)) return { ok: false, reason: 'out of reach' };

  if (spec.isDoor) {
    if (!isAir(world, x, y) || !isAir(world, x, y - 1)) {
      return { ok: false, reason: 'door needs two empty tiles' };
    }
    if (overlapsBody(body, x, y) || overlapsBody(body, x, y - 1)) {
      return { ok: false, reason: 'blocked by player' };
    }
    return { ok: true, reason: '' };
  }

  for (let dx = 0; dx < spec.footprint.w; dx++) {
    for (let dy = 0; dy < spec.footprint.h; dy++) {
      if (!isAir(world, x + dx, y + dy)) return { ok: false, reason: 'occupied' };
      if (overlapsBody(body, x + dx, y + dy)) return { ok: false, reason: 'blocked by player' };
    }
  }
  if (spec.requiresSupport && !hasSupport(world, x, y)) {
    return { ok: false, reason: 'needs support' };
  }
  return { ok: true, reason: '' };
}

export function canPlace(world: World, body: Body, item: ItemId, x: number, y: number): PlaceCheck {
  return canPlaceSpec(world, body, specForItem(item), x, y);
}

/** Writes the placed tile(s). Doors place open, bottom at (x, y). */
export function applyPlaceSpec(world: World, spec: PlaceSpec, x: number, y: number): void {
  if (spec.isDoor) {
    world.setTile(x, y, TileId.DoorBottomOpen);
    world.setTile(x, y - 1, TileId.DoorTopOpen);
    return;
  }
  if (spec.tile === null) return;
  for (let dx = 0; dx < spec.footprint.w; dx++) {
    for (let dy = 0; dy < spec.footprint.h; dy++) {
      world.setTile(x + dx, y + dy, spec.tile);
    }
  }
}

export function applyPlacement(world: World, item: ItemId, x: number, y: number): void {
  applyPlaceSpec(world, specForItem(item), x, y);
}

/** Removes a tile (and its door partner). `drop` false suppresses the item. */
export function breakTile(world: World, x: number, y: number, drop: boolean): BreakEvent | null {
  const tile = world.getTile(x, y);
  if (tile === TileId.Air || tileDefinition(tile).unbreakable) return null;
  const dropped = drop ? dropForTile(tile) : null;

  if (isDoorTile(tile)) {
    const state = doorStateAt(world, x, y);
    if (state) {
      world.setTile(state.x, state.topY, TileId.Air);
      world.setTile(state.x, state.bottomY, TileId.Air);
    }
  } else {
    const def = tileDefinition(tile);
    if (def.footprint.w > 1 || def.footprint.h > 1) {
      const originX = def.footprint.w > 1 && world.getTile(x - 1, y) === tile ? x - 1 : x;
      const originY = def.footprint.h > 1 && world.getTile(x, y - 1) === tile ? y - 1 : y;
      for (let dx = 0; dx < def.footprint.w; dx++) {
        for (let dy = 0; dy < def.footprint.h; dy++) {
          if (world.getTile(originX + dx, originY + dy) === tile) {
            world.setTile(originX + dx, originY + dy, TileId.Air);
          }
        }
      }
    } else {
      world.setTile(x, y, TileId.Air);
    }
  }

  return { x, y, tile, drop: dropped };
}

/** Stateful wrapper: tracks the current mining target and placement repeat. */
export class InteractionSystem {
  private mineX = 0;
  private mineY = 0;
  private active = false;
  private progressSeconds = 0;
  private targetSeconds = 0;
  private placeCooldown = 0;

  public get mining(): boolean {
    return this.active;
  }

  public get miningTargetX(): number {
    return this.mineX;
  }

  public get miningTargetY(): number {
    return this.mineY;
  }

  public get miningProgress(): number {
    if (!this.active || this.targetSeconds <= 0) return 0;
    return Math.min(1, this.progressSeconds / this.targetSeconds);
  }

  public heldTool(inventory: Inventory): ToolClass | null {
    const slot = inventory.selectedSlot;
    return slot ? toolClassOf(slot.item) : null;
  }

  public heldTier(inventory: Inventory): number {
    const slot = inventory.selectedSlot;
    return slot ? toolTierOf(slot.item) : 0;
  }

  public update(
    world: World,
    body: Body,
    inventory: Inventory,
    input: InteractionInput,
  ): BreakEvent | null {
    const event = this.updateMining(world, body, inventory, input);
    this.updatePlacing(world, body, inventory, input);
    return event;
  }

  private updateMining(
    world: World,
    body: Body,
    inventory: Inventory,
    input: InteractionInput,
  ): BreakEvent | null {
    if (!input.mine || !input.hasTarget || !withinReach(body, input.tileX, input.tileY)) {
      this.resetMining();
      return null;
    }

    const tile = world.getTile(input.tileX, input.tileY);
    if (tile === TileId.Air || tileDefinition(tile).unbreakable) {
      this.resetMining();
      return null;
    }

    if (input.instantMine) {
      const event = breakTile(world, input.tileX, input.tileY, true);
      this.resetMining();
      return event;
    }

    const tool = this.heldTool(inventory);
    const tier = this.heldTier(inventory);
    const profile = miningProfile(tile, tool);
    const seconds = mineSeconds(tile, tool, tier);
    if (!profile.minable || !Number.isFinite(seconds)) {
      this.resetMining();
      return null;
    }

    if (!this.active || this.mineX !== input.tileX || this.mineY !== input.tileY) {
      this.active = true;
      this.mineX = input.tileX;
      this.mineY = input.tileY;
      this.progressSeconds = 0;
      this.targetSeconds = seconds;
    } else {
      this.targetSeconds = seconds;
    }

    this.progressSeconds += input.dt;
    if (this.progressSeconds < this.targetSeconds) return null;

    const event = breakTile(world, input.tileX, input.tileY, profile.drops);
    this.resetMining();
    return event;
  }

  private updatePlacing(
    world: World,
    body: Body,
    inventory: Inventory,
    input: InteractionInput,
  ): void {
    this.placeCooldown = Math.max(0, this.placeCooldown - input.dt);
    if (!input.hasTarget || !withinReach(body, input.tileX, input.tileY)) return;

    if (input.placePressed && doorStateAt(world, input.tileX, input.tileY)) {
      toggleDoor(world, input.tileX, input.tileY, [body]);
      this.placeCooldown = INTERACTION.placeRepeatSeconds;
      return;
    }

    const wants = input.placePressed || (input.placeHeld && this.placeCooldown <= 0);
    if (!wants) return;

    const paletteTile = input.paletteTile ?? null;
    if (paletteTile !== null) {
      const spec = specForTile(paletteTile);
      if (!canPlaceSpec(world, body, spec, input.tileX, input.tileY).ok) return;
      applyPlaceSpec(world, spec, input.tileX, input.tileY);
      this.placeCooldown = INTERACTION.placeRepeatSeconds;
      return;
    }

    const slot = inventory.selectedSlot;
    if (!slot) return;
    const spec = specForItem(slot.item);
    if (spec.tile === null && !spec.isDoor) return;
    if (!canPlaceSpec(world, body, spec, input.tileX, input.tileY).ok) return;

    applyPlaceSpec(world, spec, input.tileX, input.tileY);
    if (!input.infinitePlace) inventory.removeFromSlot(inventory.selected, 1);
    this.placeCooldown = INTERACTION.placeRepeatSeconds;
  }

  private resetMining(): void {
    this.active = false;
    this.progressSeconds = 0;
    this.targetSeconds = 0;
  }
}
