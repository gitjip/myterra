import { GameLoop } from '../core/loop';
import type { RenderInfo } from '../core/loop';
import { sign } from '../core/math';
import { Profiler } from '../core/perf';
import { ItemId, itemDefinition } from '../data/items';
import { DEBUG, FRAME, FRAME_BUDGET_MS, PLAYER, TILE } from '../data/tuning';
import { Player } from '../entity/player';
import { PickupManager } from '../entity/pickup';
import { Camera } from '../render/camera';
import { DebugOverlay } from '../render/debug';
import { InteractionRenderer } from '../render/interaction';
import { ParticleSystem, particleColor } from '../render/particles';
import { PickupRenderer } from '../render/pickup';
import { PlayerRenderer } from '../render/player';
import type { TerrainRenderStats } from '../render/terrain';
import { TerrainRenderer } from '../render/terrain';
import { InteractionSystem } from '../systems/interaction';
import { Inventory } from '../systems/inventory';
import { Hud } from '../ui/hud';
import { createTestWorld, testSpawnPoint } from '../world/testWorld';
import type { World } from '../world/world';
import { InputManager } from './input';

/**
 * Composition root for a running game session.
 *
 * M3 adds mining, placing, doors, dropped items and the inventory data model.
 * The inventory panel and crafting arrive later.
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
  public readonly hud: Hud;
  public readonly input: InputManager;

  private readonly loop: GameLoop;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly playerRenderer = new PlayerRenderer();
  private readonly pickupRenderer = new PickupRenderer();
  private readonly interactionRenderer = new InteractionRenderer();
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: Array<() => void> = [];

  private aim: { x: number; y: number } | null = null;
  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private terrainStats: TerrainRenderStats | undefined;

  public constructor(
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    ctx: CanvasRenderingContext2D,
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.world = createTestWorld();
    const spawn = testSpawnPoint(this.world.reachWidth);
    this.player = new Player(spawn.x - PLAYER.width / 2, spawn.y - PLAYER.height);
    this.camera = new Camera(this.world);
    this.camera.setPosition(this.player.centreX, this.player.centreY);
    this.terrain = new TerrainRenderer(this.world);
    this.input = new InputManager(canvas);
    this.overlay = new DebugOverlay(uiRoot);
    this.hud = new Hud(uiRoot);
    this.seedInventory();

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

    this.profiler.measure('entities', FRAME_BUDGET_MS.entities, () => {
      this.player.update(
        this.world,
        { moveX: input.moveX, moveY: input.moveY, jump: input.jump },
        dt,
      );
    });

    this.profiler.measure('logic', FRAME_BUDGET_MS.logic, () => {
      this.aim = input.mouse.inside ? this.tileAtMouse(input.mouse.x, input.mouse.y) : null;
      this.updateInteraction(dt, input.mouse.left, input.mouse.right);
      this.pickups.update(this.world, this.player.centreX, this.player.centreY, dt);
      this.pickups.collect(this.player.centreX, this.player.centreY, this.inventory);
      this.particles.update(dt);
    });

    this.camera.follow(
      this.player.centreX,
      this.player.centreY,
      sign(this.player.body.vx),
      sign(this.player.body.vy),
    );
  }

  private updateInteraction(dt: number, mine: boolean, placeHeld: boolean): void {
    const target = this.aim;
    const breakEvent = this.interaction.update(this.world, this.player.body, this.inventory, {
      tileX: target?.x ?? 0,
      tileY: target?.y ?? 0,
      hasTarget: target !== null,
      mine,
      placePressed: this.input.consumePress('right'),
      placeHeld,
      dt,
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
    this.terrainStats = this.profiler.measure('render', FRAME_BUDGET_MS.render, () => {
      return this.terrain.render(this.ctx, this.camera);
    });
    this.pickupRenderer.render(this.ctx, this.camera, this.pickups);
    this.playerRenderer.render(
      this.ctx,
      this.camera,
      this.player,
      info.alpha,
      this.overlay.visible,
    );
    this.particles.render(this.ctx, this.camera);
    const highlight = this.interaction.mining
      ? { x: this.interaction.miningTargetX, y: this.interaction.miningTargetY }
      : this.aim;
    this.interactionRenderer.render(
      this.ctx,
      this.camera,
      highlight,
      this.interaction.miningProgress,
    );
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
    lines.push(
      `held ${this.heldSummary()}  drops ${this.pickups.count}  particles ${this.particles.activeCount}`,
    );
    if (this.aim) {
      lines.push(
        `aim ${this.aim.x},${this.aim.y} tile ${this.world.getTile(this.aim.x, this.aim.y)}` +
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
      const slot = hotbarSlotFromCode(event.code);
      if (slot !== null) this.inventory.select(slot);
    };

    window.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
    });
  }

  private onVisibilityChanged(_hidden: boolean): void {
    // M6+ persists the world here when the tab is hidden.
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
