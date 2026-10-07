import { describe, expect, it } from 'vitest';
import { TileId } from '../src/data/tiles';
import { LIGHT, WORLD } from '../src/data/tuning';
import { LightSystem, displayBrightness } from '../src/world/light';
import { LiquidType, World } from '../src/world/world';

/** A stone block with a sealed corridor carved out; nothing touches the sky. */
function sealedWorld(): { world: World; light: LightSystem } {
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x <= 30; x++) {
    for (let y = 0; y <= 10; y++) world.setTile(x, y, TileId.Stone);
  }
  for (let x = 1; x <= 29; x++) {
    for (let y = 5; y <= 9; y++) world.setTile(x, y, TileId.Air);
  }
  world.clearDirty();
  const light = new LightSystem(world);
  light.fullRelight();
  return { world, light };
}

function relight(light: LightSystem, x: number, y: number): void {
  light.markChanged(x, y);
  light.update();
}

describe('light', () => {
  it('leaves a sealed room fully dark', () => {
    const { world } = sealedWorld();
    const idx = world.idx(15, 7);
    expect(world.skyDepth[idx]).toBe(255);
    expect(world.blockLight[idx]).toBe(0);
  });

  it('flows sky light through an opening and decays per tile', () => {
    const { world, light } = sealedWorld();
    for (let y = 0; y <= 4; y++) world.setTile(15, y, TileId.Air);
    relight(light, 15, 0);

    expect(world.skyDepth[world.idx(15, 7)]).toBe(0);
    expect(world.skyDepth[world.idx(16, 7)]).toBe(1);
    expect(world.skyDepth[world.idx(17, 7)]).toBe(2);
  });

  it('removes all light when the opening is sealed again', () => {
    const { world, light } = sealedWorld();
    for (let y = 0; y <= 4; y++) world.setTile(15, y, TileId.Air);
    relight(light, 15, 0);
    expect(world.skyDepth[world.idx(16, 7)]).toBe(1);

    for (let y = 0; y <= 4; y++) world.setTile(15, y, TileId.Stone);
    relight(light, 15, 0);
    expect(world.skyDepth[world.idx(15, 7)]).toBe(255);
    expect(world.skyDepth[world.idx(16, 7)]).toBe(255);
    expect(world.skyDepth[world.idx(20, 7)]).toBe(255);
  });

  it('emits torch light and removes it completely', () => {
    const { world, light } = sealedWorld();
    world.setTile(15, 7, TileId.Torch);
    relight(light, 15, 7);
    expect(world.blockLight[world.idx(15, 7)]).toBe(LIGHT.torchLight);
    expect(world.blockLight[world.idx(16, 7)]).toBe(LIGHT.torchLight - 1);
    expect(world.blockLight[world.idx(17, 7)]).toBe(LIGHT.torchLight - 2);

    world.setTile(15, 7, TileId.Air);
    relight(light, 15, 7);
    expect(world.blockLight[world.idx(15, 7)]).toBe(0);
    expect(world.blockLight[world.idx(16, 7)]).toBe(0);
    expect(world.blockLight[world.idx(17, 7)]).toBe(0);
  });

  it('takes the maximum of multiple sources rather than summing', () => {
    const { world, light } = sealedWorld();
    world.setTile(13, 7, TileId.Torch);
    world.setTile(17, 7, TileId.Torch);
    relight(light, 13, 7);
    relight(light, 17, 7);
    const middle = world.blockLight[world.idx(15, 7)] ?? 0;
    expect(middle).toBe(LIGHT.torchLight - 2);
  });

  it('attenuates light faster through liquid', () => {
    const { world, light } = sealedWorld();
    world.setTile(13, 7, TileId.Torch);
    relight(light, 13, 7);
    const dry = world.blockLight[world.idx(15, 7)] ?? 0;

    world.setLiquid(13, 7, LiquidType.Water, 0);
    world.setLiquid(14, 7, LiquidType.Water, 100);
    relight(light, 14, 7);
    const wet = world.blockLight[world.idx(15, 7)] ?? 0;
    expect(wet).toBeLessThan(dry);
  });

  it('shows solid tiles lit by their neighbours instead of black', () => {
    const { world } = sealedWorld();
    // (10, 0) is the top solid tile, open air above it.
    expect(displayBrightness(world, 10, 0, 1)).toBeGreaterThan(250);
    // A solid tile next to a torch is lit too.
    world.setTile(15, 5, TileId.Torch);
    const light = new LightSystem(world);
    light.fullRelight();
    expect(displayBrightness(world, 15, 4, 0)).toBe(LIGHT.torchLight - 1);
    // Deep rock with no lit neighbour stays dark.
    expect(displayBrightness(world, 10, 3, 1)).toBe(0);
  });
});
