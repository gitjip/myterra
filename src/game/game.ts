import { GameLoop } from '../core/loop';
import type { RenderInfo } from '../core/loop';
import { sign } from '../core/math';
import { Profiler } from '../core/perf';
import { ItemId, itemDefinition } from '../data/items';
import { TileId } from '../data/tiles';
import { DEBUG, FRAME, FRAME_BUDGET_MS, LIGHT, PLAYER, TILE } from '../data/tuning';
import { Player } from '../entity/player';
import { PickupManager } from '../entity/pickup';
import { Camera } from '../render/camera';
import { DebugOverlay } from '../render/debug';
import { InteractionRenderer } from '../render/interaction';
import { LightOverlay } from '../render/lightOverlay';
import { LiquidRenderer } from '../render/liquid';
import { ParticleSystem, particleColor } from '../render/particles';
import { PickupRenderer } from '../render/pickup';
import { PlayerRenderer } from '../render/player';
import type { TerrainRenderStats } from '../render/terrain';
import { TerrainRenderer } from '../render/terrain';
import { InteractionSystem } from '../systems/interaction';
import { Inventory } from '../systems/inventory';
import { Hud } from '../ui/hud';
import { advanceDay, cssColor, dayFactorFor, skyColorFor } from '../world/dayCycle';
import { LightSystem } from '../world/light';
import { LiquidSystem } from '../world/liquid';
import { SandSystem } from '../world/sand';
import { LiquidType } from '../world/world';
import type { World } from '../world/world';
import { findSpawn } from '../world/gen/generator';
import type { LoadedState, SavePlayer, SaveStack } from '../save/apply';
import { InputManager } from './input';
import { CREATIVE_PALETTE, Mode } from './mode';
import type { ModeName } from './mode';

export interface GameOptions {
  readonly mode?: ModeName;
  readonly saved?: LoadedState | null;
}

/**
 * Composition root for a running game session.
 *
 * It consumes a ready World (produced by the menu's generator) and owns the
 * player, systems, HUD and input. Saving and returning to the menu live above.
 */
export class Game {
  public readonly profiler = new Profiler();
  public readonly overlay: DebugOverlay;
  public readonly world: World;
  public readonly player: Player;
  public readonly camera: Camera;
  public readonly terrain: TerrainRenderer;
  public readonly inventory = new Inventory();
  public readonly pickups = new PickupManager();
  public readonly particles = new ParticleSystem();
  public readonly interaction = new InteractionSystem();
  public readonly mode: Mode;
  public readonly light: LightSystem;
  public readonly liquid: LiquidSystem;
  public readonly sand: SandSystem;
  public readonly hud: Hud;
  public readonly input: InputManager;
  public timeOfDay: number = LIGHT.startTimeOfDay;
  public dayCount: number = 0;

  private readonly loop: GameLoop;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly playerRenderer = new PlayerRenderer();
  private readonly pickupRenderer = new PickupRenderer();
  private readonly interactionRenderer = new InteractionRenderer();
  private readonly lightOverlay = new LightOverlay();
  private readonly liquidRenderer = new LiquidRenderer();
  private elapsed = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: Array<() => void> = [];

  private aim: { x: number; y: number } | null = null;
  private paletteIndex = 0;
  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private terrainStats: TerrainRenderStats | undefined;

  public constructor(
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    ctx: CanvasRenderingContext2D,
    world: World,
    options: GameOptions = {},
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.world = world;
    const spawn = findSpawn(world);
    this.player = new Player(spawn.x - PLAYER.width / 2, spawn.y - PLAYER.height);
    this.mode = new Mode(options.mode ?? 'survival');
    this.player.canFly = this.mode.flags.canFly;
    if (!options.saved?.inventory) this.seedInventory();
    this.applyLoaded(options.saved ?? null);
    this.camera = new Camera(this.world);
    this.camera.setPosition(this.player.centreX, this.player.centreY);
    this.terrain = new TerrainRenderer(this.world);
    this.input = new InputManager(canvas);
    this.overlay = new DebugOverlay(uiRoot);
    this.hud = new Hud(uiRoot);

    this.timeOfDay = options.saved?.timeOfDay ?? LIGHT.startTimeOfDay;
    this.dayCount = options.saved?.dayCount ?? 0;
    this.light = new LightSystem(this.world);
    this.disposers.push(
      this.world.emitter.on('tile', ({ x, y }) => {
        this.light.markChanged(x, y);
      }),
    );
    this.disposers.push(
      this.world.emitter.on('liquid', ({ x, y }) => {
        this.light.markChanged(x, y);
      }),
    );
    this.light.dayFactor = dayFactorFor(this.timeOfDay);
    this.light.fullRelight();

    this.liquid = new LiquidSystem(this.world);
    this.sand = new SandSystem(this.world);
    this.disposers.push(
      this.world.emitter.on('tile', ({ x, y }) => {
        this.liquid.wakeNeighbourhood(x, y);
        this.sand.wakeNeighbourhood(x, y);
      }),
    );
    this.liquid.rebuildActive();

    this.inventory.emitter.on('select', (index) => {
      const slot = this.inventory.getSlot(index);
      this.hud.showItemName(slot ? nameOf(slot.item) : 'Empty Hand');
    });

    this.loop = new GameLoop({
      fixedUpdate: (dt) => {
        this.fixedUpdate(dt);
      },
      render: (info) => {
        this.render(info);
      },
      visibilityChanged: (hidden) => {
        this.onVisibilityChanged(hidden);
      },
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas);
    this.bindInput();
    this.resize();
  }

  public start(): void {
    this.fpsWindowStart = performance.now();
    this.loop.start();
  }

  public dispose(): void {
    this.loop.stop();
    this.resizeObserver.disconnect();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.input.dispose();
    this.hud.dispose();
    this.overlay.dispose();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private fixedUpdate(dt: number): void {
    this.camera.beginStep();
    const input = this.input.state;
    const flags = this.mode.flags;
    this.player.canFly = flags.canFly;

    const day = advanceDay(this.timeOfDay, this.dayCount, dt);
    this.timeOfDay = day.timeOfDay;
    this.dayCount = day.dayCount;
    this.light.dayFactor = dayFactorFor(this.timeOfDay);

    this.profiler.measure('entities', FRAME_BUDGET_MS.entities, () => {
      this.player.update(
        this.world,
        { moveX: input.moveX, moveY: input.moveY, jump: input.jump },
        dt,
      );
    });

    this.profiler.measure('logic', FRAME_BUDGET_MS.logic, () => {
      if (this.mode.name === 'creative') this.updatePaletteFromWheel();
      this.aim = input.mouse.inside ? this.tileAtMouse(input.mouse.x, input.mouse.y) : null;
      this.updateInteraction(dt, input.mouse.left, input.mouse.right);
      this.pickups.update(this.world, this.player.centreX, this.player.centreY, dt);
      this.pickups.collect(this.player.centreX, this.player.centreY, this.inventory);
      this.particles.update(dt);
    });

    this.profiler.measure('light', FRAME_BUDGET_MS.light, () => {
      this.light.update();
    });

    this.profiler.measure('liquid', FRAME_BUDGET_MS.liquid, () => {
      this.liquid.update(FRAME_BUDGET_MS.liquid);
    });

    this.profiler.measure('sand', FRAME_BUDGET_MS.sand, () => {
      this.sand.update(FRAME_BUDGET_MS.sand);
    });

    this.elapsed += dt;

    this.camera.follow(
      this.player.centreX,
      this.player.centreY,
      sign(this.player.body.vx),
      sign(this.player.body.vy),
    );
  }

  private updatePaletteFromWheel(): void {
    const wheel = this.input.consumeWheel();
    if (wheel === 0) return;
    this.paletteIndex = wrapIndex(this.paletteIndex + Math.sign(wheel), CREATIVE_PALETTE.length);
  }

  private updateInteraction(dt: number, mine: boolean, placeHeld: boolean): void {
    const target = this.aim;
    const creative = this.mode.name === 'creative';
    const paletteTile = creative ? (CREATIVE_PALETTE[this.paletteIndex] ?? null) : null;
    const breakEvent = this.interaction.update(this.world, this.player.body, this.inventory, {
      tileX: target?.x ?? 0,
      tileY: target?.y ?? 0,
      hasTarget: target !== null,
      mine,
      placePressed: this.input.consumePress('right'),
      placeHeld,
      dt,
      instantMine: this.mode.flags.instantMine,
      infinitePlace: this.mode.flags.infinitePlace,
      paletteTile,
    });

    if (breakEvent) {
      this.particles.spawnBurst(
        breakEvent.x + 0.5,
        breakEvent.y + 0.5,
        particleColor(breakEvent.tile),
      );
      if (breakEvent.drop !== null) {
        this.pickups.spawn(
          breakEvent.drop,
          1,
          breakEvent.x + 0.35,
          breakEvent.y + 0.2,
          (Math.random() - 0.5) * 3,
          -2,
        );
      }
    }
  }

  private render(info: RenderInfo): void {
    this.frames++;
    const now = performance.now();
    if (now - this.fpsWindowStart >= 500) {
      this.fps = (this.frames * 1000) / (now - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = now;
    }

    this.camera.setRenderAlpha(info.alpha);
    const sky = skyColorFor(this.timeOfDay);
    this.terrainStats = this.profiler.measure('render', FRAME_BUDGET_MS.render, () => {
      return this.terrain.render(this.ctx, this.camera, cssColor(sky));
    });
    this.liquidRenderer.render(this.ctx, this.camera, this.world, this.elapsed);
    this.pickupRenderer.render(this.ctx, this.camera, this.pickups);
    this.playerRenderer.render(
      this.ctx,
      this.camera,
      this.player,
      info.alpha,
      this.overlay.visible,
    );
    this.particles.render(this.ctx, this.camera);
    this.lightOverlay.render(this.ctx, this.camera, this.world, this.light.dayFactor);
    const highlight = this.interaction.mining
      ? { x: this.interaction.miningTargetX, y: this.interaction.miningTargetY }
      : this.aim;
    this.interactionRenderer.render(
      this.ctx,
      this.camera,
      highlight,
      this.interaction.miningProgress,
    );
    if (this.player.inLava) {
      this.ctx.fillStyle = 'rgba(180, 20, 10, 0.25)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.hud.update(this.player, this.inventory);

    this.overlay.render(this.profiler, {
      fps: this.fps,
      frameIndex: info.frameIndex,
      steps: info.steps,
      extra: (lines) => {
        this.collectExtra(lines);
      },
    });
  }

  private collectExtra(lines: string[]): void {
    const dpr = window.devicePixelRatio || 1;
    lines.push(`canvas ${this.canvas.width}x${this.canvas.height} @ dpr ${dpr.toFixed(2)}`);
    lines.push(
      `world ${this.world.width}x${this.world.height} tiles, revision ${this.world.revision}`,
    );
    lines.push(
      `camera ${this.camera.zoom}x at ${this.camera.position.x.toFixed(1)},${this.camera.position.y.toFixed(1)}`,
    );
    const body = this.player.body;
    lines.push(
      `player ${body.x.toFixed(2)},${body.y.toFixed(2)} vel ${body.vx.toFixed(2)},${body.vy.toFixed(2)} ` +
        `${body.onGround ? 'ground' : 'air'}${this.player.inWater ? ' water' : ''}${this.player.dead ? ' DEAD' : ''}`,
    );
    lines.push(
      `stats hp ${this.player.health.toFixed(1)} food ${this.player.hunger.toFixed(1)} breath ${this.player.breath.toFixed(1)}`,
    );
    const light = this.light.stats;
    lines.push(
      `day ${this.timeOfDay.toFixed(3)} x${this.dayCount} factor ${this.light.dayFactor.toFixed(3)}  ` +
        `light dirty ${light.dirty} nodes ${light.nodes} ${light.ms.toFixed(2)} ms`,
    );
    lines.push(`liquid active ${this.liquid.activeCells}  sand active ${this.sand.activeCells}`);
    const flags = this.mode.flags;
    lines.push(
      `mode ${this.mode.name} fly=${flags.canFly ? 1 : 0} instant=${flags.instantMine ? 1 : 0} ` +
        `infPlace=${flags.infinitePlace ? 1 : 0} invuln=${flags.invulnerable ? 1 : 0}`,
    );
    if (this.mode.name === 'creative') {
      const tile = CREATIVE_PALETTE[this.paletteIndex];
      lines.push(
        `palette ${this.paletteIndex + 1}/${CREATIVE_PALETTE.length} ${tile !== undefined ? TileId[tile] : '-'}`,
      );
    }
    lines.push(
      `held ${this.heldSummary()}  drops ${this.pickups.count}  particles ${this.particles.activeCount}`,
    );
    if (this.aim) {
      const cell = this.world.liquidAt(this.aim.x, this.aim.y);
      lines.push(
        `aim ${this.aim.x},${this.aim.y} tile ${this.world.getTile(this.aim.x, this.aim.y)}` +
          ` liquid ${cell.type}:${cell.amount}` +
          (this.interaction.mining
            ? ` mining ${(this.interaction.miningProgress * 100).toFixed(0)}%`
            : ''),
      );
    }
    lines.push(`inventory ${this.inventorySummary()}`);
    const stats = this.terrainStats;
    if (stats) {
      lines.push(
        `tiles ${stats.drawnTiles}/${stats.visibleTileCount}  chunks ${stats.chunksDrawn}/${stats.chunksVisible}  rebuilt ${stats.chunksRebuilt}`,
      );
    }
    lines.push(`fixed step ${(FRAME.fixedDt * 1000).toFixed(3)} ms`);
  }

  private heldSummary(): string {
    const slot = this.inventory.selectedSlot;
    if (!slot) return 'empty hand';
    return `${nameOf(slot.item)} x${slot.count}`;
  }

  private inventorySummary(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.inventory.size; i++) {
      const slot = this.inventory.getSlot(i);
      if (slot) parts.push(`${i}:${nameOf(slot.item)}x${slot.count}`);
    }
    return parts.length > 0 ? parts.join(' ') : 'empty';
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  private seedInventory(): void {
    this.inventory.addItem(ItemId.WoodPickaxe);
    this.inventory.addItem(ItemId.WoodAxe);
    this.inventory.addItem(ItemId.WoodShovel);
    this.inventory.addItem(ItemId.Torch, 20);
    this.inventory.addItem(ItemId.Door, 5);
    this.inventory.addItem(ItemId.Dirt, 50);
    this.inventory.addItem(ItemId.Stone, 50);
    this.inventory.select(0);
  }

  private applyLoaded(saved: LoadedState | null): void {
    if (!saved) return;
    if (saved.player) {
      const p = saved.player;
      this.player.body.x = p.x;
      this.player.body.y = p.y;
      this.player.body.vx = p.vx;
      this.player.body.vy = p.vy;
      this.player.health = p.health;
      this.player.hunger = p.hunger;
      this.player.breath = p.breath;
      this.player.facing = p.facing >= 0 ? 1 : -1;
    }
    if (saved.inventory) {
      this.inventory.restore(
        saved.inventory.map((slot) => (slot ? { item: slot.item, count: slot.count } : null)),
      );
    }
  }

  public capturePlayer(): SavePlayer {
    const body = this.player.body;
    return {
      x: body.x,
      y: body.y,
      vx: body.vx,
      vy: body.vy,
      health: this.player.health,
      hunger: this.player.hunger,
      breath: this.player.breath,
      facing: this.player.facing,
    };
  }

  public captureInventory(): Array<SaveStack | null> {
    return this.inventory
      .snapshot()
      .map((slot) => (slot ? { item: slot.item, count: slot.count } : null));
  }

  private tileAtMouse(mouseX: number, mouseY: number): { x: number; y: number } {
    const dpr = window.devicePixelRatio || 1;
    const scale = TILE.px * this.camera.zoom;
    const worldX = this.camera.left + (mouseX * dpr) / scale;
    const worldY = this.camera.top + (mouseY * dpr) / scale;
    return { x: Math.floor(worldX), y: Math.floor(worldY) };
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.camera.setViewport(width, height);
  }

  private bindInput(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'F3') {
        event.preventDefault();
        this.overlay.toggle();
        return;
      }
      if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        event.preventDefault();
        this.camera.changeZoom(1);
        return;
      }
      if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        event.preventDefault();
        this.camera.changeZoom(-1);
        return;
      }
      if (event.code === 'F11') {
        event.preventDefault();
        this.toggleFullscreen();
        return;
      }
      if (event.code === 'Tab') {
        event.preventDefault();
        return;
      }
      if (event.code === DEBUG.starveKey) {
        event.preventDefault();
        this.player.hunger = 0;
        return;
      }
      if (event.code === DEBUG.eatKey) {
        event.preventDefault();
        this.player.eatRaw();
        return;
      }
      if (event.code === 'F6') {
        event.preventDefault();
        this.toggleMode();
        return;
      }
      if (event.code === DEBUG.liquidKey) {
        event.preventDefault();
        this.spillLiquid();
        return;
      }
      if (event.code === DEBUG.relightKey) {
        event.preventDefault();
        this.light.fullRelight();
        return;
      }
      const slot = hotbarSlotFromCode(event.code);
      if (slot !== null) {
        if (this.mode.name === 'creative') this.selectPalette(slot);
        else this.inventory.select(slot);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
    });
  }

  private onVisibilityChanged(_hidden: boolean): void {
    // M6+ persists the world here when the tab is hidden.
  }

  private toggleMode(): void {
    const name = this.mode.toggle();
    this.player.canFly = this.mode.flags.canFly;
    this.hud.showItemName(name === 'creative' ? 'Creative Mode' : 'Survival Mode');
  }

  private selectPalette(index: number): void {
    if (index < 0 || index >= CREATIVE_PALETTE.length) return;
    this.paletteIndex = index;
    const tile = CREATIVE_PALETTE[index];
    if (tile !== undefined) this.hud.showItemName(TileId[tile]);
  }

  /** Debug: spill a little water at the aimed tile until M10 adds buckets. */
  private spillLiquid(): void {
    const target = this.aim;
    if (!target) return;
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        const x = target.x + dx;
        const y = target.y + dy;
        if (this.world.getTile(x, y) === TileId.Air) {
          this.world.setLiquid(x, y, LiquidType.Water, 100);
        }
      }
    }
    this.liquid.wakeNeighbourhood(target.x, target.y);
    this.liquid.wakeNeighbourhood(target.x + 1, target.y + 1);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }
}

function nameOf(item: ItemId): string {
  return itemDefinition(item).name;
}

function hotbarSlotFromCode(code: string): number | null {
  if (code.startsWith('Digit')) {
    const digit = Number(code.slice(5));
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9) return (digit + 9) % 10;
  }
  return null;
}

function wrapIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}
