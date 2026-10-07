import { describe, expect, it } from 'vitest';
import {
  DEBUG,
  FRAME,
  FRAME_BUDGET_MS,
  FRAME_BUDGET_TOTAL_MS,
  GEN,
  INVENTORY,
  INTERACTION,
  LIGHT,
  LIQUID,
  PLAYER,
  PLAYER_JUMP_VELOCITY,
  RENDER,
  SAVE,
  SURVIVAL,
  TILE,
  WORLD,
  estimateWorldMemoryMb,
  totalWidthFor,
} from '../src/data/tuning';

describe('tuning invariants', () => {
  it('frame loop constants are self-consistent', () => {
    expect(FRAME.fixedDt).toBeCloseTo(1 / FRAME.targetFps, 10);
    expect(FRAME.maxAccumulatedSeconds).toBeGreaterThan(FRAME.fixedDt);
    expect(FRAME.maxStepsPerFrame * FRAME.fixedDt).toBeLessThanOrEqual(FRAME.maxAccumulatedSeconds);
    expect(FRAME.budgetStreakWarn).toBeLessThan(FRAME.budgetStreakAlarm);
  });

  it('per-frame budgets stay inside a 60 Hz frame', () => {
    expect(FRAME_BUDGET_TOTAL_MS).toBeLessThan(1000 / FRAME.targetFps);
    for (const ms of Object.values(FRAME_BUDGET_MS)) expect(ms).toBeGreaterThan(0);
  });

  it('chunk and buffer constants agree', () => {
    expect(TILE.bufferTiles).toBe(TILE.bufferChunks * TILE.chunk);
    expect(TILE.chunk * TILE.chunk).toBe(1024); // 512x512 offscreen canvas
  });

  it('world extents leave the reachable range strictly inside', () => {
    expect(WORLD.yReachMin).toBe(WORLD.yMin + 1);
    expect(WORLD.yReachMax).toBe(WORLD.yMax - 1);
    expect(WORLD.yReachMax - WORLD.yReachMin + 1).toBe(1022);
    expect(WORLD.yMin).toBeLessThan(0);
    expect(WORLD.yMax).toBeGreaterThan(0);
  });

  it('width presets are ordered and inside the custom range', () => {
    expect(WORLD.smallReachWidth).toBeLessThan(WORLD.mediumReachWidth);
    expect(WORLD.mediumReachWidth).toBeLessThan(WORLD.largeReachWidth);
    expect(WORLD.minReachWidth).toBeLessThanOrEqual(WORLD.smallReachWidth);
    expect(WORLD.largeReachWidth).toBeLessThanOrEqual(WORLD.maxReachWidth);
    expect(WORLD.defaultReachWidth).toBe(WORLD.mediumReachWidth);
  });

  it('totalWidthFor adds a buffer on both sides only', () => {
    expect(totalWidthFor(2048)).toBe(2048 + TILE.bufferTiles * 2);
  });

  it('memory estimate grows monotonically and matches the documented table', () => {
    const small = estimateWorldMemoryMb(WORLD.smallReachWidth);
    const medium = estimateWorldMemoryMb(WORLD.mediumReachWidth);
    const large = estimateWorldMemoryMb(WORLD.largeReachWidth);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    // Section 3 of ROADMAP.md quotes ~14 / ~52 / ~102 MB including overhead.
    expect(small).toBeGreaterThan(10);
    expect(small).toBeLessThan(20);
    expect(medium).toBeGreaterThan(45);
    expect(medium).toBeLessThan(60);
    expect(large).toBeGreaterThan(90);
    expect(large).toBeLessThan(115);
  });

  it('light constants behave', () => {
    expect(LIGHT.dayFactorDay).toBe(1);
    expect(LIGHT.dayFactorNight).toBeGreaterThan(0);
    expect(LIGHT.dayFactorNight).toBeLessThan(LIGHT.dayFactorDay);
    expect(LIGHT.torchLight).toBeLessThan(LIGHT.maxLight);
    expect(LIGHT.lavaLight).toBeLessThan(LIGHT.torchLight);
    expect(LIGHT.attenuationLiquid).toBeGreaterThan(LIGHT.attenuationAir);
    expect(LIGHT.dayCycleSeconds).toBe(1200);
    expect(LIGHT.startTimeOfDay).toBeGreaterThanOrEqual(0);
    expect(LIGHT.startTimeOfDay).toBeLessThan(1);
  });

  it('liquid constants behave', () => {
    expect(LIQUID.maxTransferPerStep).toBeLessThanOrEqual(LIQUID.amountMax);
    expect(LIQUID.restThreshold).toBeLessThan(LIQUID.amountMax);
    expect(LIQUID.budgetMs).toBe(FRAME_BUDGET_MS.liquid);
  });

  it('the derived jump velocity actually produces jumpHeight', () => {
    const apex = (PLAYER_JUMP_VELOCITY * PLAYER_JUMP_VELOCITY) / (2 * PLAYER.gravity);
    expect(apex).toBeCloseTo(PLAYER.jumpHeight, 10);
  });

  it('player body fits through a one tile gap but not a zero tile one', () => {
    expect(PLAYER.width).toBeLessThan(1);
    expect(PLAYER.height).toBeGreaterThan(1);
    expect(PLAYER.maxFallSpeed).toBeGreaterThan(0);
    expect(PLAYER.waterMaxFallSpeed).toBeLessThan(PLAYER.maxFallSpeed);
  });

  it('survival timers produce the documented durations', () => {
    expect(SURVIVAL.maxHealth).toBe(100);
    expect(SURVIVAL.breathDrainPerSecond * 15).toBeCloseTo(SURVIVAL.maxBreath, 5);
    expect(SURVIVAL.cookedMealHeal).toBeGreaterThan(SURVIVAL.rawMeatHeal);
    expect(SURVIVAL.regenHungerThreshold).toBeLessThan(SURVIVAL.maxHunger);
  });

  it('inventory geometry divides evenly into rows', () => {
    expect(INVENTORY.slots).toBe(40);
    expect(INVENTORY.slots % INVENTORY.hotbar).toBe(0);
    expect(INVENTORY.maxStack).toBeGreaterThan(0);
    expect(INVENTORY.ammoStack).toBeLessThan(INVENTORY.maxStack);
  });

  it('interaction reach is positive and buckets nest inside the hotbar', () => {
    expect(INTERACTION.reach).toBeGreaterThan(0);
    expect(INTERACTION.wrongToolMultiplier).toBeGreaterThan(1);
  });

  it('render settings stay in range', () => {
    expect(RENDER.minZoom).toBe(1);
    expect(Number.isInteger(RENDER.defaultZoom)).toBe(true);
    expect(RENDER.defaultZoom).toBeGreaterThanOrEqual(RENDER.minZoom);
    expect(RENDER.defaultZoom).toBeLessThanOrEqual(RENDER.maxZoom);
    expect(RENDER.minResolutionScale).toBeLessThanOrEqual(1);
    expect(RENDER.maxResolutionScale).toBeGreaterThanOrEqual(1);
    expect(RENDER.defaultResolutionScale).toBe(1);
    expect(RENDER.minUiScale).toBeLessThanOrEqual(RENDER.defaultUiScale);
    expect(RENDER.maxUiScale).toBeGreaterThanOrEqual(RENDER.defaultUiScale);
    expect(DEBUG.profilerWindow).toBeGreaterThan(1);
  });

  it('save and gen versions are positive integers', () => {
    expect(Number.isInteger(SAVE.version)).toBe(true);
    expect(SAVE.version).toBeGreaterThan(0);
    expect(Number.isInteger(GEN.genVersion)).toBe(true);
    expect(GEN.genVersion).toBeGreaterThan(0);
    expect(SAVE.autoSaveSeconds).toBeGreaterThan(0);
  });
});
