import { DebugOverlay } from '../render/debug';
import { GameLoop } from '../core/loop';
import { Profiler } from '../core/perf';
import { FRAME, FRAME_BUDGET_MS, RENDER, TEST_WORLD } from '../data/tuning';
import type { RenderInfo } from '../core/loop';
import { Camera } from '../render/camera';
import type { TerrainRenderStats } from '../render/terrain';
import { TerrainRenderer } from '../render/terrain';
import { createTestWorld } from '../world/testWorld';
import type { World } from '../world/world';

/**
 * Composition root for a running game session.
 *
 * M1 adds a resident test world, camera and cached terrain renderer. Player
 * physics remains deliberately out of this composition root until M2.
 */
export class Game {
  public readonly profiler = new Profiler();
  public readonly overlay: DebugOverlay;
  public readonly world: World;
  public readonly camera: Camera;
  public readonly terrain: TerrainRenderer;

  private readonly loop: GameLoop;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: Array<() => void> = [];
  private readonly keys = new Set<string>();

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
    this.camera = new Camera(this.world);
    this.camera.setPosition(
      this.world.reachWidth / 2 + TEST_WORLD.wallXOffset,
      TEST_WORLD.surfaceY - TEST_WORLD.previewCameraYOffset,
    );
    this.terrain = new TerrainRenderer(this.world);
    this.overlay = new DebugOverlay(uiRoot);

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
    this.overlay.dispose();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private fixedUpdate(dt: number): void {
    // M2+ runs player physics; M8 adds liquid/sand; M7 adds light.
    this.profiler.measure('logic', FRAME_BUDGET_MS.logic, () => {
      const horizontal =
        (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) -
        (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
      const vertical =
        (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0) -
        (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0);
      this.camera.move(
        horizontal * RENDER.previewPanSpeed * dt,
        vertical * RENDER.previewPanSpeed * dt,
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

    this.terrainStats = this.profiler.measure('render', FRAME_BUDGET_MS.render, () => {
      return this.terrain.render(this.ctx, this.camera);
    });

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
      `css ${Math.round(this.canvas.clientWidth)}x${Math.round(this.canvas.clientHeight)}`,
    );
    lines.push(
      `world ${this.world.width}x${this.world.height} tiles, revision ${this.world.revision}`,
    );
    lines.push(
      `camera ${this.camera.zoom}x at ${this.camera.position.x.toFixed(1)},${this.camera.position.y.toFixed(1)}`,
    );
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
      this.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.keys.delete(event.code);
    };
    const onVisibilityChange = (): void => {
      this.loop.setHidden(document.hidden);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  private onVisibilityChanged(hidden: boolean): void {
    // M6+ persists the world here when the tab is hidden.
    if (hidden) this.keys.clear();
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }
}
