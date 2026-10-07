/**
 * Every gameplay number in MyTerra lives here and nowhere else.
 * Section 18 of ROADMAP.md is the source of truth; this file is its executable form.
 *
 * Rule: if a number is not in this file, it does not belong in game code.
 */

// ---------------------------------------------------------------------------
// Frame loop and per-frame budgets
// ---------------------------------------------------------------------------

export const FRAME = {
  /** Logical frames per second. */
  targetFps: 60,
  /** Fixed timestep, seconds. */
  fixedDt: 1 / 60,
  /** Never run more than this many fixed steps in one rendered frame. */
  maxStepsPerFrame: 5,
  /** Hard cap on unprocessed accumulated time, seconds. Prevents the death spiral. */
  maxAccumulatedSeconds: 0.25,
  /** Consecutive over-budget frames before the overlay turns yellow / red. */
  budgetStreakWarn: 60,
  budgetStreakAlarm: 300,
} as const;

/**
 * Per-frame millisecond budgets, section 17 of ROADMAP.md.
 * Overbudget work is deferred to the next frame, never accumulated.
 */
export const FRAME_BUDGET_MS = {
  entities: 2.0,
  liquid: 2.0,
  sand: 1.0,
  light: 1.0,
  render: 8.0,
  logic: 2.0,
} as const;

export type BudgetKey = keyof typeof FRAME_BUDGET_MS;

export const FRAME_BUDGET_TOTAL_MS = Object.values(FRAME_BUDGET_MS).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Tile grid geometry
// ---------------------------------------------------------------------------

export const TILE = {
  /** Logical pixels per tile. */
  px: 16,
  /** Chunk edge in tiles. Chunks are a generation batching unit only, never loaded/unloaded. */
  chunk: 32,
  /** Unreachable buffer on each edge, in chunks. */
  bufferChunks: 4,
  /** Unreachable buffer on each edge, in tiles. */
  bufferTiles: 128,
} as const;

// ---------------------------------------------------------------------------
// World extents
// ---------------------------------------------------------------------------

export const WORLD = {
  yMin: -512,
  yMax: 511,
  /** Player-reachable vertical range; excludes the buffer rows. */
  yReachMin: -511,
  yReachMax: 510,
  /** Small world reachable width. */
  smallReachWidth: 2048,
  /** Medium world reachable width, and the default. */
  mediumReachWidth: 8192,
  /** Large world reachable width. */
  largeReachWidth: 16384,
  defaultReachWidth: 8192,
  minReachWidth: 1024,
  maxReachWidth: 32768,
  /** fg + wall + skyDepth + blockLight + liquidType + liquidAmount. */
  bytesPerCell: 6,
  /** The documented estimate covers the six grid arrays, excluding transient buffers. */
  peakMemoryFactor: 1,
} as const;

/** Total stored columns for a given reachable width, including both buffers. */
export function totalWidthFor(reachWidth: number): number {
  return reachWidth + TILE.bufferTiles * 2;
}

/** Rough grid-memory estimate in megabytes, shown when creating a world. */
export function estimateWorldMemoryMb(reachWidth: number): number {
  const cells = totalWidthFor(reachWidth) * (WORLD.yMax - WORLD.yMin + 1);
  const bytes = cells * WORLD.bytesPerCell;
  return (bytes * WORLD.peakMemoryFactor) / (1024 * 1024);
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

export const LIGHT = {
  /** Sky depth is stored, not final brightness. Render multiplies by dayFactor. */
  dayFactorDay: 1.0,
  dayFactorNight: 40 / 255,
  /** 20 minutes. */
  dayCycleSeconds: 1200,
  /** Noon is 0.25; a new world starts late morning. */
  startTimeOfDay: 0.3,
  torchLight: 200,
  lavaLight: 180,
  attenuationAir: 1,
  attenuationLiquid: 3,
  /** Enemies only spawn where combined light is at or below this. */
  spawnLightThreshold: 100,
  maxLight: 255,
} as const;

// ---------------------------------------------------------------------------
// Liquids
// ---------------------------------------------------------------------------

export const LIQUID = {
  amountMax: 100,
  maxTransferPerStep: 25,
  /** Rest when the level difference to neighbours is below this and nothing can fall. */
  restThreshold: 2,
  budgetMs: 2.0,
  /** Global cap on cells processed per fixed tick. */
  maxCellsPerTick: 20_000,
  waterSpeedFactor: 0.55,
  lavaDamagePerSecond: 30,
} as const;

// ---------------------------------------------------------------------------
// Sand
// ---------------------------------------------------------------------------

export const SAND = {
  budgetMs: 1.0,
  maxCellsPerTick: 20_000,
  /** Ticks a falling grain keeps its transient state after moving before settling. */
  settleDelayTicks: 1,
} as const;

// ---------------------------------------------------------------------------
// Player physics. Grid units per second unless stated otherwise.
// ---------------------------------------------------------------------------

export const PLAYER = {
  width: 0.8,
  height: 1.8,
  moveSpeed: 15,
  jumpHeight: 6,
  gravity: 30,
  maxFallSpeed: 30,
  accelGround: 60,
  accelAir: 30,
  frictionGround: 40,
  frictionAir: 4,
  waterGravityFactor: 0.5,
  waterMaxFallSpeed: 8,
  waterUpSpeed: 12,
  flySpeedHorizontal: 20,
  flySpeedVertical: 15,
} as const;

/** Jump start speed that reaches exactly PLAYER.jumpHeight under PLAYER.gravity. */
export const PLAYER_JUMP_VELOCITY = Math.sqrt(2 * PLAYER.gravity * PLAYER.jumpHeight);

// ---------------------------------------------------------------------------
// Survival stats
// ---------------------------------------------------------------------------

export const SURVIVAL = {
  maxHealth: 100,
  maxHunger: 100,
  maxBreath: 100,
  drownDamagePerSecond: 5,
  starveDamagePerSecond: 2,
  regenPerSecond: 1,
  regenHungerThreshold: 80,
  hungerDrainPerSecond: 0.07,
  breathDrainPerSecond: 100 / 15,
  breathRegenPerSecond: 40,
  rawMeatHeal: 20,
  cookedMealHeal: 40,
  eatDuration: 0.8,
} as const;

// ---------------------------------------------------------------------------
// Items, inventory, chest
// ---------------------------------------------------------------------------

export const INVENTORY = {
  slots: 40,
  hotbar: 10,
  maxStack: 999,
  /** Items that stack less well, keyed by item id string; see data/items.ts. */
  ammoStack: 200,
  chestSlots: 20,
} as const;

// ---------------------------------------------------------------------------
// Mining and placing
// ---------------------------------------------------------------------------

export const INTERACTION = {
  /** Rectangular reach: player bounds expanded by this many tiles. */
  reach: 5,
  /** Time multiplier when the held tool is the wrong class. */
  wrongToolMultiplier: 4,
} as const;

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export const COMBAT = {
  meleeCooldown: 0.4,
  /** Invulnerability window granted to the attacker on a successful hit. */
  hitInvulnerability: 0.5,
  swingDuration: 0.15,
  swingArcDegrees: 90,
  knockback: 12,
  bowCharge: 0.6,
  arrowSpeed: 22,
  arrowGravity: 6,
  projectileLimit: 100,
} as const;

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const ENTITY = {
  /** Chebyshev radius around the player in which entities are simulated. */
  simulateRadius: 128,
  /** Beyond this Chebyshev radius entities are destroyed. */
  despawnRadius: 192,
  maxEnemies: 20,
  pickupRadius: 1.2,
  pickupLifetimeSeconds: 300,
} as const;

// ---------------------------------------------------------------------------
// World generation
// ---------------------------------------------------------------------------

export const GEN = {
  /**
   * Bump whenever generation output changes. Stored in the save header because
   * background walls are regenerated from the seed and would otherwise misalign.
   */
  genVersion: 1,
  /** Per-frame generation budget during the progress screen, milliseconds. */
  budgetMs: 8.0,
  biomeTransitionTiles: 48,
  waterLevelOffset: 8,
} as const;

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export const SAVE = {
  version: 1,
  autoSaveSeconds: 60,
  slotsPerWorld: 2,
} as const;

// ---------------------------------------------------------------------------
// Render and UI
// ---------------------------------------------------------------------------

export const RENDER = {
  /** Integer zoom only, for crisp pixels. */
  minZoom: 1,
  maxZoom: 6,
  defaultZoom: 3,
  defaultResolutionScale: 1,
  minResolutionScale: 0.5,
  maxResolutionScale: 1,
  defaultUiScale: 1,
  minUiScale: 0.75,
  maxUiScale: 2,
  /** Camera dead zone and look-ahead, in pixels. */
  cameraDeadZone: 8,
  cameraLookAhead: 24,
  /** HUD overlay refresh rate, Hz. */
  overlayHz: 5,
} as const;

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

export const DEBUG = {
  defaultShowOverlay: false,
  /** Rolling window length for profiler statistics. */
  profilerWindow: 300,
} as const;
