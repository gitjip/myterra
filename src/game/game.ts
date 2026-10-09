import { GameLoop } from '../core/loop';
import type { RenderInfo } from '../core/loop';
import { clamp, rectsOverlap, sign } from '../core/math';
import { Profiler } from '../core/perf';
import { Rng } from '../core/rng';
import { ItemId, bonusDropsForTile, itemDefinition, stationOfTile } from '../data/items';
import { TileId } from '../data/tiles';
import { ENEMIES } from '../data/enemies';
import type { DevBridge } from '../dev/bridge';
import {
  DEBUG,
  FRAME,
  FRAME_BUDGET_MS,
  INTERACTION,
  LIGHT,
  PLAYER,
  RENDER,
  TILE,
  COMBAT,
} from '../data/tuning';
import { Player } from '../entity/player';
import { PickupManager } from '../entity/pickup';
import { Enemy } from '../entity/enemy';
import type { Passive } from '../entity/passive';
import { PassiveManager } from '../entity/passive';
import { ProjectileManager } from '../entity/projectile';
import { Camera } from '../render/camera';
import { DebugOverlay } from '../render/debug';
import { DamageNumbers, EnemyRenderer } from '../render/enemy';
import { PassiveRenderer } from '../render/passive';
import { InteractionRenderer } from '../render/interaction';
import { LightOverlay } from '../render/lightOverlay';
import { LiquidRenderer } from '../render/liquid';
import { ParticleSystem, particleColor } from '../render/particles';
import { PickupRenderer } from '../render/pickup';
import { PlayerRenderer } from '../render/player';
import type { TerrainRenderStats } from '../render/terrain';
import { TerrainRenderer } from '../render/terrain';
import { InteractionSystem, bucketUse, withinReach } from '../systems/interaction';
import { Inventory } from '../systems/inventory';
import type { InventorySlot } from '../systems/inventory';
import { ContainerStore } from '../systems/containers';
import { craft } from '../systems/crafting';
import { CombatSystem } from '../systems/combat';
import { Furnace } from '../systems/furnace';
import { SpawnSystem } from '../systems/spawn';
import { loadSettings, saveSettings } from '../systems/settings';
import type { Settings } from '../systems/settings';
import { CreativePanel } from '../ui/creativePanel';
import { DeathPanel } from '../ui/death';
import { FurnacePanel } from '../ui/furnace';
import { Hud } from '../ui/hud';
import { InventoryPanel } from '../ui/inventory';
import { PausePanel } from '../ui/pause';
import { SettingsPanel } from '../ui/settings';
import { advanceDay, cssColor, dayFactorFor, skyColorFor } from '../world/dayCycle';
import { LightSystem } from '../world/light';
import { LiquidSystem } from '../world/liquid';
import { SandSystem } from '../world/sand';
import { LiquidType } from '../world/world';
import type { World } from '../world/world';
import { findSpawn } from '../world/gen/generator';
import type { LoadedState, SaveChest, SaveInventory, SavePlayer } from '../save/apply';
import { InputManager } from './input';
import { Mode } from './mode';
import type { ModeName } from './mode';

export interface GameOptions {
  readonly mode?: ModeName;
  readonly saved?: LoadedState | null;
  /** World seed, so spawns and loot are reproducible per world. */
  readonly seed?: number;
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
  public readonly enemies: Enemy[] = [];
  public readonly hud: Hud;
  public readonly input: InputManager;
  /** Set by the shell so the death screen can return to the menu. */
  public onExitToMenu: () => void = () => {};
  /** Set by the shell so the dev console can force a save. */
  public onRequestSave: () => void = () => {};
  /** Resolved world seed. */
  public readonly seed: number;
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
  private readonly enemyRenderer = new EnemyRenderer();
  private readonly passiveRenderer = new PassiveRenderer();
  private readonly damageNumbers = new DamageNumbers();
  private readonly combat = new CombatSystem();
  private readonly rng: Rng;
  private readonly spawnSystem: SpawnSystem;
  private readonly passives: PassiveManager;
  private readonly projectiles = new ProjectileManager();
  private readonly furnaces = new Map<string, Furnace>();
  private readonly containers = new ContainerStore();
  private furnacePanel: FurnacePanel | undefined;
  private inventoryPanel: InventoryPanel | undefined;
  private deathPanel: DeathPanel | undefined;
  private pausePanel: PausePanel | undefined;
  private settingsPanel: SettingsPanel | undefined;
  private creativePanel: CreativePanel | undefined;
  public settings: Settings;
  private paused = false;
  private readonly uiRoot: HTMLElement;
  private uiState: 'none' | 'inventory' | 'workbench' | 'anvil' | 'furnace' | 'chest' = 'none';
  private activeChest: InventorySlot[] | null = null;
  private spawnX = 0;
  private spawnY = 0;
  private activeFurnace: Furnace | null = null;
  private chargeTimer = 0;
  private charging = false;
  private elapsed = 0;
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
    world: World,
    options: GameOptions = {},
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.world = world;
    this.uiRoot = uiRoot;
    this.settings = loadSettings(localSettingsStore());
    this.seed = options.seed ?? (Math.random() * 0x1_0000_0000) >>> 0;
    this.rng = new Rng(this.seed);
    this.spawnSystem = new SpawnSystem(this.rng);
    this.passives = new PassiveManager(this.rng);
    const spawn = findSpawn(world);
    this.spawnX = options.saved?.spawnX ?? spawn.x;
    this.spawnY = options.saved?.spawnY ?? spawn.y;
    this.player = new Player(spawn.x - PLAYER.width / 2, spawn.y - PLAYER.height);
    this.mode = new Mode(options.mode ?? 'survival');
    this.syncPlayerAbilities();
    if (!options.saved?.inventory && (options.mode ?? 'survival') === 'survival') this.seedInventory();
    this.applyLoaded(options.saved ?? null);
    this.camera = new Camera(this.world);
    this.camera.setPosition(this.player.centreX, this.player.centreY);
    this.terrain = new TerrainRenderer(this.world);
    this.input = new InputManager(canvas);
    this.overlay = new DebugOverlay(uiRoot);
    this.hud = new Hud(uiRoot);
    this.hud.setSurvival(this.mode.name === 'survival');
    this.furnacePanel = new FurnacePanel(uiRoot);
    this.inventoryPanel = new InventoryPanel(uiRoot);
    this.inventoryPanel.bind(this.inventory, null);
    this.inventoryPanel.onCraft = (recipe) => {
      craft(recipe, this.inventory, this.mode.flags.skipCrafting);
    };
    this.furnacePanel.onInsert = (item) => {
      this.insertFurnace(item);
    };
    this.furnacePanel.onCollect = () => {
      this.activeFurnace?.collectOutput(this.inventory);
    };
    this.deathPanel = new DeathPanel(uiRoot);
    this.deathPanel.onRespawn = () => {
      this.respawnPlayer();
    };
    this.deathPanel.onExit = () => {
      this.onExitToMenu();
    };

    this.pausePanel = new PausePanel(uiRoot);
    this.settingsPanel = new SettingsPanel(uiRoot);
    this.creativePanel = new CreativePanel(uiRoot);
    this.pausePanel.onResume = () => {
      this.setPaused(false);
    };
    this.pausePanel.onSettings = () => {
      this.openSettings();
    };
    this.pausePanel.onSaveExit = () => {
      this.onExitToMenu();
    };
    this.settingsPanel.onClose = () => {
      this.settingsPanel?.set(false);
      if (this.paused) this.pausePanel?.set(true);
    };
    this.settingsPanel.onSettingsChange = (settings) => {
      this.settings = settings;
      saveSettings(settings, localSettingsStore());
      this.applySettings();
    };
    this.settingsPanel.onModeChange = (name) => {
      this.setMode(name);
      this.settingsPanel?.sync(this.settings, this.mode.name, this.input.keymap);
    };
    this.settingsPanel.onRebind = (action, code) => {
      this.input.remap(action, code);
      this.settingsPanel?.sync(this.settings, this.mode.name, this.input.keymap);
    };
    this.creativePanel.onPick = (item) => {
      const leftover = this.inventory.addToHotbar(item, itemDefinition(item).stackMax);
      if (leftover > 0) this.toast(`${itemDefinition(item).name}: inventory full`);
    };

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
    this.light.queueFullRelight();

    this.liquid = new LiquidSystem(this.world);
    this.sand = new SandSystem(this.world);
    this.liquid.startRebuild();
    this.disposers.push(
      this.world.emitter.on('tile', ({ x, y }) => {
        this.liquid.wakeNeighbourhood(x, y);
        this.sand.wakeNeighbourhood(x, y);
      }),
    );

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
    this.applySettings();
  }

  public start(): void {
    this.fpsWindowStart = performance.now();
    this.loop.start();
  }

  /** Narrow handle the dev console drives the game through. */
  public devBridge(): DevBridge {
    return {
      teleport: (x, y) => {
        this.player.body.x = x;
        this.player.body.y = y;
        this.player.body.vx = 0;
        this.player.body.vy = 0;
      },
      teleportToAim: () => {
        const aim = this.aim;
        if (!aim) return false;
        this.player.body.x = aim.x;
        this.player.body.y = aim.y;
        this.player.body.vx = 0;
        this.player.body.vy = 0;
        return true;
      },
      teleportToSpawn: () => {
        this.respawnPlayer();
      },
      setTimeOfDay: (timeOfDay) => {
        this.timeOfDay = clamp(timeOfDay, 0, 1);
        this.light.dayFactor = dayFactorFor(this.timeOfDay);
      },
      advanceDays: (days) => {
        this.dayCount += days;
      },
      give: (item, count) => this.inventory.addToHotbar(item, count),
      clearInventory: () => { this.inventory.clear(); },
      spawnEnemy: (kind, count) => {
        const aim = this.aim;
        const baseX = aim ? aim.x : Math.round(this.player.centreX);
        const baseY = aim ? aim.y : Math.round(this.player.centreY);
        let spawned = 0;
        for (let i = 0; i < count; i++) {
          const x = baseX + (i % 3) - 1;
          this.enemies.push(new Enemy(kind, x, baseY - ENEMIES[kind].height));
          spawned++;
        }
        return spawned;
      },
      clearEnemies: () => {
        const removed = this.enemies.length;
        this.enemies.length = 0;
        return removed;
      },
      clearDrops: () => {
        const removed = this.pickups.count;
        this.pickups.clear();
        return removed;
      },
      setGod: (on) => {
        this.player.invulnerable = on;
      },
      setFlight: (on) => {
        this.player.canFly = on;
      },
      killPlayer: () => {
        this.player.health = 0;
        this.player.dead = true;
      },
      healPlayer: () => {
        this.respawnPlayer();
      },
      fullRelight: () => { this.light.fullRelight(); },
      rebuildLiquid: () => { this.liquid.startRebuild(); },
      rebuildChunks: () => { this.terrain.chunks.clear(); },
      saveNow: () => { this.onRequestSave(); },
      seed: () => this.seed,
      modeName: () => this.mode.name,
      aim: () => (this.aim ? { x: this.aim.x, y: this.aim.y } : null),
      resetProfiler: () => { this.profiler.clearWindow(); },
    };
  }

  public dispose(): void {
    this.loop.stop();
    this.resizeObserver.disconnect();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.input.dispose();
    this.hud.dispose();
    this.overlay.dispose();
    this.terrain.dispose();
    this.furnacePanel?.dispose();
    this.inventoryPanel?.dispose();
    this.deathPanel?.dispose();
    this.pausePanel?.dispose();
    this.settingsPanel?.dispose();
    this.creativePanel?.dispose();
  }

  /** True while a dialog is open, so Escape closes it before leaving the game. */
  public isUiOpen(): boolean {
    return (
      this.uiState !== 'none' ||
      this.paused ||
      (this.deathPanel?.open ?? false) ||
      (this.settingsPanel?.open ?? false) ||
      (this.creativePanel?.open ?? false)
    );
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private fixedUpdate(dt: number): void {
    // The creative panel and the pause menu freeze simulation; settings do not.
    if (this.paused || (this.creativePanel?.open ?? false)) return;
    this.camera.beginStep();
    const input = this.input.state;
    const flags = this.mode.flags;
    this.player.canFly = flags.canFly;
    this.player.invulnerable = flags.invulnerable;
    this.player.hasHunger = flags.hasHunger;
    this.player.hasBreath = flags.hasBreath;

    const day = advanceDay(this.timeOfDay, this.dayCount, dt);
    this.timeOfDay = day.timeOfDay;
    this.dayCount = day.dayCount;
    this.light.dayFactor = dayFactorFor(this.timeOfDay);

    this.profiler.measure('entities', FRAME_BUDGET_MS.entities, () => {
      this.player.armorReduction = this.inventory.armorReduction();
      this.player.update(
        this.world,
        { moveX: input.moveX, moveY: input.moveY, jump: input.jump },
        dt,
      );
      this.combat.update(dt);
      const hostile = this.mode.flags.enemiesHostile;
      for (const enemy of this.enemies) {
        // Non-hostile enemies idle in place rather than chasing.
        enemy.update(
          this.world,
          hostile ? this.player.centreX : enemy.centreX,
          hostile ? this.player.centreY : enemy.centreY,
          dt,
        );
        if (hostile) {
          const shot = enemy.consumeShot();
          if (shot) {
            this.projectiles.spawn(
              'enemy',
              shot.damage,
              enemy.centreX,
              enemy.centreY,
              shot.vx,
              shot.vy,
            );
          }
        }
        if (
          hostile &&
          !this.player.dead &&
          !this.mode.flags.invulnerable &&
          this.player.invulnTimer <= 0 &&
          rectsOverlap(enemy.body, this.player.body)
        ) {
          const dir = Math.sign(this.player.centreX - enemy.centreX) || 1;
          this.player.hurt(enemy.def.contactDamage, dir * 6, -4);
        }
      }
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (!(this.enemies[i]?.alive ?? false)) this.enemies.splice(i, 1);
      }
      this.spawnSystem.update(
        this.world,
        this.player.centreX,
        this.player.centreY,
        this.light.dayFactor,
        this.enemies,
        dt,
      );
      this.passives.update(
        this.world,
        this.player.centreX,
        this.player.centreY,
        this.light.dayFactor,
        dt,
      );
      this.projectiles.update(this.world, dt);
      this.resolveProjectiles();
    });

    if (this.player.dead) {
      if (!(this.deathPanel?.open ?? false)) {
        this.setUi('none');
        this.creativePanel?.set(false);
        this.settingsPanel?.set(false);
        this.pausePanel?.set(false);
        this.paused = false;
        this.deathPanel?.show();
      }
    } else if (this.deathPanel?.open ?? false) {
      this.deathPanel?.hide();
    }

    this.profiler.measure('logic', FRAME_BUDGET_MS.logic, () => {
      this.updateHotbarFromWheel();
      this.aim = input.mouse.inside ? this.tileAtMouse(input.mouse.x, input.mouse.y) : null;
      this.updateHeldAction(dt, input.mouse.left, input.mouse.right);
      this.pickups.update(this.world, this.player.centreX, this.player.centreY, dt);
      this.pickups.collect(this.player.centreX, this.player.centreY, this.inventory);
      this.particles.update(dt);
      this.damageNumbers.update(dt);
      for (const furnace of this.furnaces.values()) furnace.update(dt);
    });

    this.profiler.measure('light', this.settings.lightBudgetMs, () => {
      this.light.update(this.settings.lightBudgetMs);
    });

    this.profiler.measure('liquid', this.settings.liquidBudgetMs, () => {
      this.liquid.rebuildActiveIncremental(this.settings.liquidBudgetMs);
      this.liquid.update(this.settings.liquidBudgetMs);
    });

    this.profiler.measure('sand', this.settings.sandBudgetMs, () => {
      this.sand.update(this.settings.sandBudgetMs);
    });

    this.elapsed += dt;

    this.camera.follow(
      this.player.centreX,
      this.player.centreY,
      sign(this.player.body.vx),
      sign(this.player.body.vy),
    );
  }

  /** Wheel cycles the hotbar selection, the same in both modes. */
  private updateHotbarFromWheel(): void {
    const wheel = this.input.consumeWheel();
    if (wheel === 0) return;
    this.inventory.select(wrapIndex(this.inventory.selected + Math.sign(wheel), 10));
  }

  private updateInteraction(dt: number, mine: boolean, placeHeld: boolean): void {
    const target = this.aim;

    // Right-clicking a workstation opens its dialog instead of placing.
    let placePressed = this.input.consumePress('right');
    if (placePressed) {
      const slot = this.inventory.selectedSlot;
      if (slot && itemDefinition(slot.item).isBucket && this.useBucket(slot.item)) {
        placePressed = false;
      }
    }
    if (placePressed) {
      const slot = this.inventory.selectedSlot;
      const food = slot ? itemDefinition(slot.item).food : null;
      if (food && this.player.applyFood(food)) {
        this.inventory.removeFromSlot(this.inventory.selected, 1);
        placePressed = false;
      }
    }
    if (placePressed && target && withinReach(this.player.body, target.x, target.y)) {
      const station = stationOfTile(this.world.getTile(target.x, target.y));
      if (station !== null && this.openStation(station, target.x, target.y)) {
        placePressed = false;
      }
    }

    const breakEvent = this.interaction.update(this.world, this.player.body, this.inventory, {
      tileX: target?.x ?? 0,
      tileY: target?.y ?? 0,
      hasTarget: target !== null,
      mine,
      placePressed,
      placeHeld,
      dt,
      instantMine: this.mode.flags.instantMine,
      infinitePlace: this.mode.flags.infinitePlace,
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
          this.rng.nextRange(-1.5, 1.5),
          -2,
        );
      }
      for (const bonus of bonusDropsForTile(breakEvent.tile)) {
        if (!this.rng.chance(bonus.chance)) continue;
        this.pickups.spawn(
          bonus.item,
          this.rng.nextIntRange(bonus.min, bonus.max + 1),
          breakEvent.x + 0.35,
          breakEvent.y + 0.2,
          this.rng.nextRange(-1.5, 1.5),
          -2,
        );
      }
      if (breakEvent.tile === TileId.Chest) this.spillChest(breakEvent.x, breakEvent.y);
    }
  }

  private spillChest(x: number, y: number): void {
    const contents = this.containers.removeNear(x, y);
    if (!contents) return;
    for (const stack of contents) {
      if (!stack) continue;
      this.pickups.spawn(
        stack.item,
        stack.count,
        x + 0.35,
        y + 0.2,
        this.rng.nextRange(-1.5, 1.5),
        -2,
      );
    }
  }

  private renderProjectiles(): void {
    const scale = TILE.px * this.camera.zoom;
    const size = Math.max(1, Math.round(scale * 0.25));
    for (const projectile of this.projectiles.all) {
      const screen = this.camera.worldToScreen(projectile.body.x, projectile.body.y);
      this.ctx.fillStyle = projectile.owner === 'player' ? '#efe6c8' : '#cbb8a0';
      this.ctx.fillRect(screen.x, screen.y, size, size);
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
      return this.terrain.render(this.ctx, this.camera, cssColor(sky), this.overlay.visible);
    });
    this.liquidRenderer.render(this.ctx, this.camera, this.world, this.elapsed);
    this.pickupRenderer.render(this.ctx, this.camera, this.pickups);
    this.enemyRenderer.render(this.ctx, this.camera, this.enemies);
    this.passiveRenderer.render(this.ctx, this.camera, this.passives.rabbits);
    this.renderProjectiles();
    this.playerRenderer.render(
      this.ctx,
      this.camera,
      this.player,
      info.alpha,
      this.overlay.visible,
    );
    this.particles.render(this.ctx, this.camera);
    this.lightOverlay.render(this.ctx, this.camera, this.world, this.light.dayFactor, this.light.version);
    this.damageNumbers.render(this.ctx, this.camera);
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
    if (this.uiState !== 'none') {
      // Stations can change as the player moves while the panel is open.
      this.inventoryPanel?.setCrafting(
        { workbench: this.hasStation(TileId.Workbench), anvil: this.hasStation(TileId.Anvil) },
        this.mode.flags.skipCrafting,
        this.uiState === 'inventory' || this.uiState === 'workbench' || this.uiState === 'anvil',
      );
    }
    this.inventoryPanel?.update();
    if (this.uiState === 'furnace' && this.activeFurnace) {
      this.furnacePanel?.update(this.activeFurnace, this.inventory);
    }

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
    lines.push(`canvas ${this.canvas.width}x${this.canvas.height} logical`);
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
        `light dirty ${light.dirty} nodes ${light.nodes} ${light.ms.toFixed(2)} ms${this.light.isRelightPending ? ' relighting' : ''}`,
    );
    lines.push(
      `liquid active ${this.liquid.activeCells}  sand active ${this.sand.activeCells}  ` +
        `rebuild ${this.liquid.rebuilding ? 'pending' : 'done'}`,
    );
    const flags = this.mode.flags;
    lines.push(
      `mode ${this.mode.name} ui ${this.uiState} sim ${this.settings.simulationDistance} ` +
        `fly=${flags.canFly ? 1 : 0} instant=${flags.instantMine ? 1 : 0} ` +
        `infPlace=${flags.infinitePlace ? 1 : 0} invuln=${flags.invulnerable ? 1 : 0}`,
    );
    if (this.mode.name === 'creative') {
      lines.push(`creative panel: press C`);
    }
    lines.push(
      `held ${this.heldSummary()}  enemies ${this.enemies.length}  arrows ${this.projectiles.count}  drops ${this.pickups.count}  particles ${this.particles.activeCount}`,
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
    lines.push(`inventory ${this.usedSlots()}/${this.inventory.size} slots used`);
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

  private usedSlots(): number {
    let used = 0;
    for (let i = 0; i < this.inventory.size; i++) {
      if (this.inventory.getSlot(i)) used++;
    }
    return used;
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  private seedInventory(): void {
    this.inventory.addItem(ItemId.WoodPickaxe);
    this.inventory.addItem(ItemId.WoodAxe);
    this.inventory.addItem(ItemId.WoodShovel);
    this.inventory.addItem(ItemId.Bow);
    this.inventory.addItem(ItemId.Chest, 1);
    this.inventory.addItem(ItemId.Torch, 20);
    this.inventory.addItem(ItemId.Workbench, 1);
    this.inventory.addItem(ItemId.Furnace, 1);
    this.inventory.addItem(ItemId.EmptyBucket, 1);
    this.inventory.addItem(ItemId.Anvil, 1);
    this.inventory.addItem(ItemId.Bed, 1);
    this.inventory.addItem(ItemId.Wood, 40);
    this.inventory.addItem(ItemId.Stone, 50);
    this.inventory.addItem(ItemId.IronIngot, 10);
    this.inventory.addItem(ItemId.Coal, 20);
    this.inventory.addItem(ItemId.RawMeat, 3);
    this.inventory.addItem(ItemId.Silk, 16);
    this.inventory.addItem(ItemId.Rope, 16);
    this.inventory.addItem(ItemId.GoldIngot, 10);
    this.inventory.setEquipment('ammo', { item: ItemId.Arrow, count: 50 });
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
      this.inventory.restore(saved.inventory.slots);
      this.inventory.restoreEquipment(saved.inventory.equipment);
    }
    if (saved.chests) this.containers.restore(saved.chests);
    // Death is never persisted: a reloaded dead player respawns with full stats.
    if (this.player.dead || this.player.health <= 0) {
      this.player.respawn(this.spawnX - PLAYER.width / 2, this.spawnY - PLAYER.height);
    }
  }

  private respawnPlayer(): void {
    this.player.respawn(this.spawnX - PLAYER.width / 2, this.spawnY - PLAYER.height);
    this.deathPanel?.hide();
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

  public captureInventory(): SaveInventory {
    return {
      slots: this.inventory
        .snapshot()
        .map((slot) => (slot ? { item: slot.item, count: slot.count } : null)),
      equipment: this.inventory
        .snapshotEquipment()
        .map((slot) => (slot ? { item: slot.item, count: slot.count } : null)),
    };
  }

  public captureChests(): SaveChest[] {
    return this.containers.entries().map((chest) => ({
      x: chest.x,
      y: chest.y,
      slots: chest.slots.map((slot) => (slot ? { item: slot.item, count: slot.count } : null)),
    }));
  }

  private tileAtMouse(mouseX: number, mouseY: number): { x: number; y: number } {
    const backingScale = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    return this.camera.pointerToTile(mouseX, mouseY, backingScale);
  }

  private toggleInventory(): void {
    if (this.creativePanel?.open) this.creativePanel.set(false);
    if (this.settingsPanel?.open) this.settingsPanel.set(false);
    if (this.pausePanel?.open) this.setPaused(false);
    this.setUi(this.uiState === 'none' ? 'inventory' : 'none');
  }

  private setUi(state: typeof this.uiState): void {
    this.uiState = state;
    if (state !== 'chest') this.activeChest = null;
    this.inventoryPanel?.bind(this.inventory, state === 'chest' ? this.activeChest : null);
    this.inventoryPanel?.setOpen(state !== 'none');
    this.inventoryPanel?.setCrafting(
      { workbench: this.hasStation(TileId.Workbench), anvil: this.hasStation(TileId.Anvil) },
      this.mode.flags.skipCrafting,
      state === 'inventory' || state === 'workbench' || state === 'anvil',
    );
    this.furnacePanel?.set(state === 'furnace');
    if (state !== 'furnace') this.activeFurnace = null;
    this.hud.setHotbarVisible(state === 'none');
  }

  private applySettings(): void {
    this.camera.setRenderRadius(this.settings.renderDistance);
    const despawn = this.settings.simulationDistance + 64;
    this.spawnSystem.simulateRadius = this.settings.simulationDistance;
    this.spawnSystem.despawnRadius = despawn;
    this.passives.simulateRadius = this.settings.simulationDistance;
    this.passives.despawnRadius = despawn;
    this.uiRoot.style.setProperty('--ui-scale', String(this.settings.uiScale));
    this.overlay.toggle(this.settings.showOverlay);
    this.settingsPanel?.sync(this.settings, this.mode.name, this.input.keymap);
    this.resize();
  }

  private setMode(name: ModeName): void {
    this.mode.set(name);
    this.syncPlayerAbilities();
    if (name !== 'creative') this.creativePanel?.set(false);
    this.hud.setSurvival(name === 'survival');
    this.hud.showItemName(name === 'creative' ? 'Creative Mode' : 'Survival Mode');
  }

  private syncPlayerAbilities(): void {
    const flags = this.mode.flags;
    this.player.canFly = flags.canFly;
    this.player.invulnerable = flags.invulnerable;
    this.player.hasHunger = flags.hasHunger;
    this.player.hasBreath = flags.hasBreath;
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.pausePanel?.set(paused);
    if (paused) {
      this.setUi('none');
      this.settingsPanel?.set(false);
      this.creativePanel?.set(false);
    }
  }

  private openSettings(): void {
    this.pausePanel?.set(false);
    this.creativePanel?.set(false);
    this.setUi('none');
    this.settingsPanel?.sync(this.settings, this.mode.name, this.input.keymap);
    this.settingsPanel?.set(true);
  }

  private toast(message: string): void {
    const element = document.createElement('div');
    element.textContent = message;
    element.className = 'mt-toast';
    this.uiRoot.append(element);
    window.setTimeout(() => {
      element.remove();
    }, 1800);
  }

  /** Escape routing: close dialogs first, otherwise toggle the pause menu. */
  private onEscape(): void {
    if (this.settingsPanel?.open) {
      this.settingsPanel.set(false);
      return;
    }
    if (this.creativePanel?.open) {
      this.creativePanel.set(false);
      return;
    }
    if (this.uiState !== 'none') {
      this.setUi('none');
      return;
    }
    this.setPaused(!this.paused);
  }

  private openStation(station: string, x: number, y: number): boolean {
    if (station === 'workbench' || station === 'anvil') {
      this.setUi(station);
      return true;
    }
    if (station === 'furnace') {
      const key = this.furnaceKey(x, y);
      let furnace = this.furnaces.get(key);
      if (!furnace) {
        furnace = new Furnace();
        this.furnaces.set(key, furnace);
      }
      this.activeFurnace = furnace;
      this.setUi('furnace');
      return true;
    }
    if (station === 'chest') {
      const originX = this.world.getTile(x - 1, y) === TileId.Chest ? x - 1 : x;
      this.activeChest = this.containers.ensure(originX, y);
      this.setUi('chest');
      return true;
    }
    if (station === 'bed') {
      const originX = this.world.getTile(x - 1, y) === TileId.Bed ? x - 1 : x;
      this.spawnX = originX + 1;
      this.spawnY = y;
      return true;
    }
    return false;
  }

  private furnaceKey(x: number, y: number): string {
    const originX = this.world.getTile(x - 1, y) === TileId.Furnace ? x - 1 : x;
    return `${originX},${y}`;
  }

  private insertFurnace(item: ItemId): void {
    const furnace = this.activeFurnace;
    if (!furnace) return;
    if (furnace.addInput(item, this.inventory) && furnace.fuelSeconds <= 0) {
      if (this.inventory.countOf(ItemId.Coal) > 0) {
        furnace.addFuel(ItemId.Coal, this.inventory);
      } else if (this.inventory.countOf(ItemId.Wood) > 0) {
        furnace.addFuel(ItemId.Wood, this.inventory);
      }
    }
  }

  private updateHeldAction(dt: number, leftHeld: boolean, rightHeld: boolean): void {
    const slot = this.inventory.selectedSlot;
    const def = slot ? itemDefinition(slot.item) : null;

    if (def?.isBow) {
      if (leftHeld) {
        this.charging = true;
        this.chargeTimer = Math.min(COMBAT.bowCharge, this.chargeTimer + dt);
      } else {
        if (this.charging) this.fireBow();
        this.charging = false;
        this.chargeTimer = 0;
      }
      this.player.moveScale = this.charging ? COMBAT.bowMoveScale : 1;
      this.updateInteraction(dt, false, rightHeld);
      return;
    }

    this.charging = false;
    this.chargeTimer = 0;
    this.player.moveScale = 1;
    const weapon = def?.weaponDamage ?? 0;
    if (weapon > 0 && leftHeld && this.combat.trySwing()) this.performSwing(weapon);
    this.updateInteraction(dt, leftHeld && weapon <= 0, rightHeld);
  }

  private fireBow(): void {
    const fraction = this.chargeTimer / COMBAT.bowCharge;
    if (fraction < COMBAT.bowMinCharge) return;
    if (this.inventory.ammoCount() <= 0) return;
    this.inventory.consumeAmmo(1);
    const speed = COMBAT.arrowSpeed * fraction;
    const dir = this.player.facing;
    this.projectiles.spawn(
      'player',
      COMBAT.arrowDamage,
      this.player.centreX,
      this.player.centreY - 0.1,
      dir * speed,
      0,
    );
  }

  private resolveProjectiles(): void {
    for (const projectile of [...this.projectiles.all]) {
      if (!projectile.alive) continue;
      let hit = false;
      const dir = Math.sign(projectile.body.vx) || 1;

      if (projectile.owner === 'player') {
        for (const enemy of this.enemies) {
          if (!enemy.alive || !rectsOverlap(projectile.body, enemy.body)) continue;
          const killed = enemy.hit(projectile.damage, dir);
          this.damageNumbers.spawn(enemy.centreX, enemy.body.y, projectile.damage);
          if (killed && this.mode.flags.enemiesHostile) this.dropEnemyLoot(enemy);
          hit = true;
          break;
        }
      } else if (
        !this.player.dead &&
        !this.mode.flags.invulnerable &&
        rectsOverlap(projectile.body, this.player.body)
      ) {
        this.player.hurt(projectile.damage, dir * 3, -2);
        hit = true;
      }

      if (!hit) {
        for (const passive of this.passives.rabbits) {
          if (!passive.alive || !rectsOverlap(projectile.body, passive.body)) continue;
          const killed = passive.hit(projectile.damage, dir);
          this.damageNumbers.spawn(passive.centreX, passive.body.y, projectile.damage);
          if (killed) this.dropPassiveLoot(passive);
          hit = true;
          break;
        }
      }

      if (hit) {
        projectile.alive = false;
        this.projectiles.remove(projectile);
      }
    }
  }

  private useBucket(item: ItemId): boolean {
    const target = this.aim;
    if (!target || !withinReach(this.player.body, target.x, target.y)) return false;
    const result = bucketUse(this.world, item, target.x, target.y);
    if (!result.ok) return false;
    this.liquid.wakeNeighbourhood(target.x, target.y);
    this.inventory.setSlot(this.inventory.selected, { item: result.item, count: 1 });
    return true;
  }

  private performSwing(damage: number): void {
    const region = this.combat.region(this.player.body, this.player.facing);
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hitCooldown > 0) continue;
      if (!CombatSystem.overlaps(region, enemy.body)) continue;
      const dir = Math.sign(enemy.centreX - this.player.centreX) || this.player.facing;
      const killed = enemy.hit(damage, dir);
      this.damageNumbers.spawn(enemy.centreX, enemy.body.y, damage);
      if (killed && this.mode.flags.enemiesHostile) this.dropEnemyLoot(enemy);
    }
    for (const passive of this.passives.rabbits) {
      if (!passive.alive) continue;
      if (!CombatSystem.overlaps(region, passive.body)) continue;
      const dir = Math.sign(passive.centreX - this.player.centreX) || this.player.facing;
      const killed = passive.hit(damage, dir);
      this.damageNumbers.spawn(passive.centreX, passive.body.y, damage);
      if (killed) this.dropPassiveLoot(passive);
    }
  }

  private dropPassiveLoot(passive: Passive): void {
    for (const drop of passive.def.drops) {
      if (!this.rng.chance(drop.chance)) continue;
      this.pickups.spawn(
        drop.item,
        this.rng.nextIntRange(drop.min, drop.max + 1),
        passive.centreX - 0.2,
        passive.body.y,
        this.rng.nextRange(-1.5, 1.5),
        -2,
      );
    }
  }

  private dropEnemyLoot(enemy: Enemy): void {
    for (const drop of enemy.def.drops) {
      if (!this.rng.chance(drop.chance)) continue;
      const count = this.rng.nextIntRange(drop.min, drop.max + 1);
      this.pickups.spawn(
        drop.item,
        count,
        enemy.centreX - 0.2,
        enemy.body.y,
        this.rng.nextRange(-1.5, 1.5),
        -2,
      );
    }
  }

  private hasStation(tile: TileId): boolean {
    const body = this.player.body;
    const reach = INTERACTION.reach;
    const minX = Math.floor(body.x) - reach;
    const maxX = Math.floor(body.x + body.w) + reach;
    const minY = Math.floor(body.y) - reach;
    const maxY = Math.floor(body.y + body.h) + reach;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.world.getTile(x, y) === tile) return true;
      }
    }
    return false;
  }

  private resize(): void {
    const width = RENDER.logicalWidth;
    const height = RENDER.logicalHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const factor = Math.max(
      1,
      Math.floor(Math.min(window.innerWidth / width, window.innerHeight / height)),
    );
    this.canvas.style.width = `${width * factor}px`;
    this.canvas.style.height = `${height * factor}px`;
    this.camera.setViewport(width, height);
  }

  private bindInput(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'F3') {
        event.preventDefault();
        const visible = this.overlay.toggle();
        this.settings = { ...this.settings, showOverlay: visible };
        saveSettings(this.settings, localSettingsStore());
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
      if (event.code === 'Escape') {
        event.preventDefault();
        this.onEscape();
        return;
      }
      if (event.code === 'KeyE') {
        event.preventDefault();
        if (!this.paused) this.toggleInventory();
        return;
      }
      if (event.code === 'KeyC') {
        event.preventDefault();
        if (this.mode.name === 'creative' && !this.paused) {
          if (!this.creativePanel?.open) {
            this.setUi('none');
            this.settingsPanel?.set(false);
          }
          this.creativePanel?.toggle();
        }
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

  private toggleMode(): void {
    this.setMode(this.mode.toggle());
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

function localSettingsStore(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function wrapIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}
