import type { Profiler } from '../core/perf';
import { BudgetWatcher } from '../core/perf';
import type { BudgetHealth } from '../core/perf';
import { DEBUG, RENDER } from '../data/tuning';
import { formatMs } from '../core/math';

export interface OverlayContext {
  readonly fps: number;
  readonly frameIndex: number;
  readonly steps: number;
  /** Appended below the profiler table. */
  extra(lines: string[]): void;
}

/**
 * The F3 developer overlay. DOM rather than canvas, so it costs no draw budget
 * and stays crisp at any resolution scale.
 */
export class DebugOverlay {
  private readonly root: HTMLDivElement;
  private readonly heading: HTMLDivElement;
  private readonly body: HTMLPreElement;
  private readonly watcher = new BudgetWatcher();
  private lastPaint = 0;
  private readonly minIntervalMs: number;
  private currentHealth: BudgetHealth = 'ok';

  public constructor(
    parent: HTMLElement,
    public visible: boolean = DEBUG.defaultShowOverlay,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'myterra-overlay';
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      padding: '8px 10px',
      background: 'rgba(6, 8, 14, 0.82)',
      border: '1px solid #2a2f45',
      borderRadius: '4px',
      color: '#d7dceb',
      font: '12px/1.45 ui-monospace, Menlo, Consolas, monospace',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      zIndex: '1000',
      display: this.visible ? 'block' : 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    this.heading = document.createElement('div');
    Object.assign(this.heading.style, {
      fontWeight: 'bold',
      marginBottom: '4px',
      letterSpacing: '0.5px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.heading.textContent = 'MyTerra';

    this.body = document.createElement('pre');
    Object.assign(this.body.style, {
      margin: '0',
      font: 'inherit',
      whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);

    this.root.append(this.heading, this.body);
    parent.append(this.root);
    this.minIntervalMs = 1000 / RENDER.overlayHz;
  }

  /** Flips visibility. Returns the new state. */
  public toggle(force?: boolean): boolean {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
    return this.visible;
  }

  public render(profiler: Profiler, context: OverlayContext): void {
    if (!this.visible) return;

    const now = performance.now();
    if (now - this.lastPaint < this.minIntervalMs) return;
    this.lastPaint = now;

    const stats = profiler.stats();
    this.currentHealth = this.watcher.update(stats.some((s) => s.avgOverBudget));
    this.paintHeading(context);
    this.paintBody(stats, context);
  }

  public get health(): BudgetHealth {
    return this.currentHealth;
  }

  public dispose(): void {
    this.root.remove();
  }

  private paintHeading(context: OverlayContext): void {
    const healthColor: Record<BudgetHealth, string> = {
      ok: '#8b93b0',
      warn: '#fbbf24',
      alarm: '#f87171',
    };
    const healthLabel: Record<BudgetHealth, string> = {
      ok: 'OK',
      warn: 'BUDGET',
      alarm: 'OVER',
    };
    this.heading.style.color = healthColor[this.currentHealth];
    this.heading.textContent = `MyTerra  ${context.fps.toFixed(1)} fps  frame ${context.frameIndex}  steps ${context.steps}  [${healthLabel[this.currentHealth]}]`;
  }

  private paintBody(stats: ReturnType<Profiler['stats']>, context: OverlayContext): void {
    const lines: string[] = [];
    if (stats.length === 0) {
      lines.push('(no spans recorded yet)');
    } else {
      lines.push('span              last    avg     p95     max   budget');
      for (const s of stats) {
        const mark = s.avgOverBudget ? '!' : ' ';
        const budget = s.budget === null ? '      -' : formatMs(s.budget).padStart(8);
        lines.push(
          `${(s.name + mark).padEnd(15)}${formatMs(s.last).padStart(6)}${formatMs(s.avg).padStart(8)}` +
            `${formatMs(s.p95).padStart(8)}${formatMs(s.max).padStart(8)}${budget}`,
        );
      }
    }
    lines.push('');
    context.extra(lines);
    this.body.textContent = lines.join('\n');
  }
}
