import { DebugOverlay } from '../render/debug';
import { GameLoop } from '../core/loop';
import { Profiler } from '../core/perf';
import { FRAME, FRAME_BUDGET_MS, TILE } from '../data/tuning';
import type { RenderInfo } from '../core/loop';

/**
 * Composition root for a running game session.
 *
 * M0 owns only the shell: canvas sizing, the fixed-step loop, the profiler and
 * the F3 overlay. Terrain, world and player get wired in as their milestones
 * land; nothing else here needs to change for that.
 */
export class Game {
  public readonly profiler = new Profiler();
  public readonly overlay: DebugOverlay;

  private readonly loop: GameLoop;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: Array<() => void> = [];

  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private sweepPhase = 0;

  public constructor(
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    ctx: CanvasRenderingContext2D,
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
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

  private fixedUpdate(_dt: number): void {
    // M2+ runs player physics; M7 adds liquid/sand; M6 adds light.
    this.profiler.measure('logic', FRAME_BUDGET_MS.logic, () => {});
  }

  private render(info: RenderInfo): void {
    this.frames++;
    const now = performance.now();
    if (now - this.fpsWindowStart >= 500) {
      this.fps = (this.frames * 1000) / (now - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = now;
    }

    this.profiler.measure('render', FRAME_BUDGET_MS.render, () => {
      this.drawTestPattern(info.realDelta);
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

  /**
   * M0 stand-in for terrain rendering: proves the loop runs, that grid lines
   * land on single device pixels, and that elapsed time advances. Replaced by
   * render/camera + render/chunks in M1.
   */
  private drawTestPattern(realDelta: number): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1a1a26';
    for (let x = 0; x < width; x += TILE.px) ctx.fillRect(x, 0, 1, height);
    for (let y = 0; y < height; y += TILE.px) ctx.fillRect(0, y, width, 1);

    this.sweepPhase += realDelta;
    if (this.sweepPhase > 2) this.sweepPhase -= 2;
    const x = (this.sweepPhase / 2) * (width + 64) - 64;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(Math.round(x), Math.round(height / 2 - 12), 64, 24);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('MyTerra M0 - core loop online', 16, 16);
    ctx.fillText('F3 toggles the debug overlay', 16, 40);
  }

  private collectExtra(lines: string[]): void {
    const dpr = window.devicePixelRatio || 1;
    lines.push(`canvas ${this.canvas.width}x${this.canvas.height} @ dpr ${dpr.toFixed(2)}`);
    lines.push(
      `css ${Math.round(this.canvas.clientWidth)}x${Math.round(this.canvas.clientHeight)}`,
    );
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
  }

  private bindInput(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'F3') {
        event.preventDefault();
        this.overlay.toggle();
      }
    };
    const onVisibilityChange = (): void => {
      this.loop.setHidden(document.hidden);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  private onVisibilityChanged(_hidden: boolean): void {
    // M5+ persists the world here when the tab is hidden.
  }
}
