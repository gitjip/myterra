import { GEN, SAVE } from '../data/tuning';
import { Game } from '../game/game';
import { sizeCanvasToWindow } from '../render/canvasSize';
import { applySave, encodeSave } from '../save/apply';
import type { LoadedState } from '../save/apply';
import { SaveStore } from '../save/persist';
import type { WorldMeta } from '../save/persist';
import { WorldGenerator, findSpawn } from '../world/gen/generator';
import type { World } from '../world/world';
import { CreateWorldScreen } from './createWorld';
import type { WorldConfig } from './createWorld';
import { MainMenu } from './mainMenu';

/**
 * Top-level screen router. It owns the menu, the new-world dialog, the
 * incremental generation loop, the running Game, and all save triggers.
 */
export class Shell {
  private readonly menu: MainMenu;
  private readonly create: CreateWorldScreen;
  private readonly store = new SaveStore();
  private game: Game | null = null;
  private meta: WorldMeta | null = null;
  private generator: WorldGenerator | null = null;
  private pendingConfig: WorldConfig | null = null;
  private pendingMeta: WorldMeta | null = null;
  private pendingSaved: Uint8Array | null = null;
  private generationHandle = 0;
  private saveTimer = 0;
  private toastTimer = 0;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
    private readonly ctx: CanvasRenderingContext2D,
  ) {
    this.menu = new MainMenu(uiRoot);
    this.create = new CreateWorldScreen(uiRoot);

    this.menu.onNewWorld = () => {
      this.menu.hide();
      this.create.show();
    };
    this.create.onCancel = () => {
      this.cancelGeneration();
    };
    this.create.onStart = (config) => {
      this.beginWorld(config);
    };

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('resize', this.onWindowResize);
    sizeCanvasToWindow(canvas);
    this.create.hide();
    this.menu.show();
    void this.initializeStore();
  }

  /** The running game, or null at the menu. Used by the dev tooling. */
  public getGame(): Game | null {
    return this.game;
  }

  public dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('resize', this.onWindowResize);
    this.stopAutosave();
    this.stopGeneration();
    this.game?.dispose();
    this.game = null;
    this.store.close();
    this.menu.dispose();
    this.create.dispose();
  }

  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------

  private async initializeStore(): Promise<void> {
    try {
      await this.store.open();
      const worlds = await this.store.listWorlds();
      const latest = worlds[0];
      this.menu.setContinue(latest !== undefined, () => {
        if (latest) void this.continueWorld(latest);
      });
    } catch (error) {
      console.warn('[myterra] save store unavailable', error);
    }
  }

  private async continueWorld(meta: WorldMeta): Promise<void> {
    this.menu.hide();
    this.create.show();
    try {
      const loaded = await this.store.loadWorld(meta.id);
      this.beginWorld(
        { name: meta.name, seed: meta.seed, reachWidth: meta.reachWidth, mode: meta.mode },
        meta,
        loaded?.bytes ?? null,
      );
    } catch (error) {
      this.toast(`Could not load world: ${(error as Error).message}`);
      this.create.hide();
      this.menu.show();
    }
  }

  private async saveCurrentWorld(): Promise<void> {
    const game = this.game;
    const meta = this.meta;
    if (!game || !meta) return;
    try {
      const bytes = encodeSave({
        world: game.world,
        seed: meta.seed,
        mode: game.mode.name,
        timeOfDay: game.timeOfDay,
        dayCount: game.dayCount,
        spawnX: meta.spawnX,
        spawnY: meta.spawnY,
        createdAt: meta.createdAt,
        playedMs: Date.now() - meta.createdAt,
        player: game.capturePlayer(),
        inventory: game.captureInventory(),
        chests: game.captureChests(),
      });
      this.meta = await this.store.saveWorld(meta, bytes);
    } catch (error) {
      console.warn('[myterra] save failed', error);
      this.toast('Save failed');
    }
  }

  // -------------------------------------------------------------------------
  // Generation and game lifecycle
  // -------------------------------------------------------------------------

  private beginWorld(
    config: WorldConfig,
    meta: WorldMeta | null = null,
    saved: Uint8Array | null = null,
  ): void {
    this.pendingConfig = config;
    this.pendingMeta = meta;
    this.pendingSaved = saved;
    this.generator = new WorldGenerator(config.seed, config.reachWidth);
    this.create.setGenerating(true, config.seed);
    this.create.setProgress(0);
    this.generationHandle = requestAnimationFrame(this.tickGeneration);
  }

  private readonly tickGeneration = (): void => {
    const generator = this.generator;
    if (!generator) return;
    generator.step(GEN.budgetMs);
    this.create.setProgress(generator.progress);

    if (!generator.done) {
      this.generationHandle = requestAnimationFrame(this.tickGeneration);
      return;
    }

    const world = generator.world;
    const config = this.pendingConfig;
    const pendingMeta = this.pendingMeta;
    const saved = this.pendingSaved;
    this.generator = null;
    this.pendingConfig = null;
    this.pendingMeta = null;
    this.pendingSaved = null;
    this.generationHandle = 0;
    if (!config) {
      this.create.hide();
      this.menu.show();
      return;
    }

    let loaded: LoadedState | null = null;
    if (saved) {
      try {
        loaded = applySave(world, saved);
      } catch (error) {
        this.toast(`Could not load world: ${(error as Error).message}`);
        this.create.setGenerating(false, config.seed);
        this.create.hide();
        this.menu.show();
        return;
      }
    }
    const meta = pendingMeta ?? this.createMeta(config, world);
    this.startGame(world, meta, loaded);
  };

  private createMeta(config: WorldConfig, world: World): WorldMeta {
    const spawn = findSpawn(world);
    const now = Date.now();
    return {
      id: `${now.toString(36)}-${config.seed.toString(36)}`,
      name: config.name,
      reachWidth: config.reachWidth,
      seed: config.seed,
      mode: config.mode,
      createdAt: now,
      lastPlayed: now,
      // First save rotates into slot 0.
      lastSlot: 1,
      spawnX: spawn.x,
      spawnY: spawn.y,
    };
  }

  private startGame(world: World, meta: WorldMeta, loaded: LoadedState | null): void {
    this.create.setGenerating(false, meta.seed);
    this.create.hide();
    // Defensive: never leak a previous game's loop, observers or listeners.
    this.stopAutosave();
    this.game?.dispose();
    this.game = null;
    this.game = new Game(this.canvas, this.uiRoot, this.ctx, world, {
      mode: loaded?.mode ?? meta.mode,
      saved: loaded,
      seed: meta.seed,
    });
    this.game.onExitToMenu = () => {
      void this.exitToMenu();
    };
    this.game.onRequestSave = () => {
      void this.saveCurrentWorld();
    };
    this.meta = meta;
    this.game.start();
    this.startAutosave();
  }

  private cancelGeneration(): void {
    this.stopGeneration();
    this.create.hide();
    this.menu.show();
  }

  private stopGeneration(): void {
    if (this.generationHandle) cancelAnimationFrame(this.generationHandle);
    this.generationHandle = 0;
    this.generator = null;
    this.pendingConfig = null;
    this.pendingMeta = null;
    this.pendingSaved = null;
  }

  private async exitToMenu(): Promise<void> {
    if (!this.game) return;
    await this.saveCurrentWorld();
    this.stopAutosave();
    this.game.dispose();
    this.game = null;
    this.meta = null;
    this.create.hide();
    this.menu.show();
    void this.initializeStore();
  }

  // -------------------------------------------------------------------------
  // Triggers
  // -------------------------------------------------------------------------

  private startAutosave(): void {
    this.stopAutosave();
    this.saveTimer = window.setInterval(() => {
      void this.saveCurrentWorld();
    }, SAVE.autoSaveSeconds * 1000);
  }

  private stopAutosave(): void {
    if (this.saveTimer) window.clearInterval(this.saveTimer);
    this.saveTimer = 0;
  }

  private readonly onVisibility = (): void => {
    if (document.hidden && this.game) void this.saveCurrentWorld();
  };

  private readonly onWindowResize = (): void => {
    if (this.game) this.game.resizeCanvas();
    else sizeCanvasToWindow(this.canvas);
  };

  private readonly onBeforeUnload = (): void => {
    if (this.game) void this.saveCurrentWorld();
  };

  private toast(message: string): void {
    const existing = this.uiRoot.querySelector('.mt-toast');
    existing?.remove();
    const toast = document.createElement('div');
    toast.className = 'mt-toast mt-toast--error';
    toast.textContent = message;
    this.uiRoot.append(toast);
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.remove();
    }, 2500);
  }
}
