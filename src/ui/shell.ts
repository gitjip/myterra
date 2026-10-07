import { GEN } from '../data/tuning';
import { Game } from '../game/game';
import { WorldGenerator } from '../world/gen/generator';
import type { World } from '../world/world';
import { CreateWorldScreen } from './createWorld';
import type { WorldConfig } from './createWorld';
import { MainMenu } from './mainMenu';

/**
 * Top-level screen router. It owns the main menu, the new-world dialog, the
 * incremental generation loop and the running Game, plus returning to menu.
 */
export class Shell {
  private readonly menu: MainMenu;
  private readonly create: CreateWorldScreen;
  private game: Game | null = null;
  private generator: WorldGenerator | null = null;
  private pendingConfig: WorldConfig | null = null;
  private generationHandle = 0;

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
      this.beginGeneration(config);
    };

    window.addEventListener('keydown', this.onKeyDown);
    this.create.hide();
    this.menu.show();
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.stopGeneration();
    this.game?.dispose();
    this.game = null;
    this.menu.dispose();
    this.create.dispose();
  }

  private beginGeneration(config: WorldConfig): void {
    this.pendingConfig = config;
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

    if (generator.done) {
      const world = generator.world;
      const config = this.pendingConfig;
      this.generator = null;
      if (config) this.startGame(config, world);
      return;
    }
    this.generationHandle = requestAnimationFrame(this.tickGeneration);
  };

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
  }

  private startGame(config: WorldConfig, world: World): void {
    this.stopGeneration();
    this.create.setGenerating(false, config.seed);
    this.create.hide();
    this.game = new Game(this.canvas, this.uiRoot, this.ctx, world, { mode: config.mode });
    this.game.start();
  }

  private exitToMenu(): void {
    if (!this.game) return;
    this.game.dispose();
    this.game = null;
    this.menu.show();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.game) {
      event.preventDefault();
      this.exitToMenu();
    }
  };
}
