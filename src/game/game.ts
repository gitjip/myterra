import { GameLoop } from '../core/loop';
import type { RenderInfo } from '../core/loop';
import { sign } from '../core/math';
import { Profiler } from '../core/perf';
import { DEBUG, FRAME, FRAME_BUDGET_MS, PLAYER, TILE } from '../data/tuning';
import { Player } from '../entity/player';
import { Camera } from '../render/camera';
import { DebugOverlay } from '../render/debug';
import { PlayerRenderer } from '../render/player';
import type { TerrainRenderStats } from '../render/terrain';
import { TerrainRenderer } from '../render/terrain';
import { createTestWorld, testSpawnPoint } from '../world/testWorld';
import type { World } from '../world/world';
import { Hud } from '../ui/hud';
import { InputManager } from './input';

/**
 * Composition root for a running game session.
 *
 * M2 adds the player, its physics and survival stats, a DOM HUD and the input
 * layer. Mining, placing and the inventory stay out until M3.
 */
export class Game {
  public readonly profiler = new Profiler();
  public readonly overlay: DebugOverlay;
  public readonly world: World;
  public readonly player: Player;
  public readonly camera: Camera;
  public readonly terrain: TerrainRenderer;
  public readonly hud: Hud;
  public readonly input: InputManager;

  private readonly loop: GameLoop;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly playerRenderer: PlayerRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: Array<() => void> = [];

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
    this.playerRenderer = new PlayerRenderer();
    this.input = new InputManager(canvas);
    this.overlay = new DebugOverlay(uiRoot);
    this.hud = new Hud(uiRoot);

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
    // M3 adds mining/placing; M7 adds light; M8 adds liquid/sand.
    this.camera.beginStep();
    this.profiler.measure('entities', FRAME_BUDGET_MS.entities, () => {
      const input = this.input.state;
      this.player.update(
        this.world,
        { moveX: input.moveX, moveY: input.moveY, jump: input.jump },
        dt,
      );
      this.camera.follow(
        this.player.centreX,
        this.player.centreY,
        sign(this.player.body.vx),
        sign(this.player.body.vy),
      );
    });
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
    this.playerRenderer.render(
      this.ctx,
      this.camera,
      this.player,
      info.alpha,
      this.overlay.visible,
    );
    this.hud.update(this.player);

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
    lines.push(`hotbar slot ${this.hud.selected + 1}`);
    const input = this.input.state;
    if (input.mouse.inside) {
      const scale = TILE.px * this.camera.zoom;
      const tileX = Math.floor(this.camera.left + input.mouse.x / scale);
      const tileY = Math.floor(this.camera.top + input.mouse.y / scale);
      lines.push(
        `cursor ${tileX},${tileY}  L${input.mouse.left ? 1 : 0} R${input.mouse.right ? 1 : 0} M${input.mouse.middle ? 1 : 0}`,
      );
    }
    const stats = this.terrainStats;
    if (stats) {
      lines.push(
        `tiles ${stats.drawnTiles}/${stats.visibleTileCount}  chunks ${stats.chunksDrawn}/${stats.chunksVisible}  rebuilt ${stats.chunksRebuilt}`,
      );
      lines.push(
        `view ${stats.visibleRect.minX}..${stats.visibleRect.maxX}, ${stats.visibleRect.minY}..${stats.visibleRect.maxY}`,
      );
    }
    lines.push(`fixed step ${(FRAME.fixedDt * 1000).toFixed(3)} ms`);
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

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
      if (slot !== null) {
        this.hud.setSelectedSlot(slot);
        this.hud.showItemName('Empty Hand');
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

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }
}

function hotbarSlotFromCode(code: string): number | null {
  if (code.startsWith('Digit')) {
    const digit = Number(code.slice(5));
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9) return (digit + 9) % 10;
  }
  return null;
}
