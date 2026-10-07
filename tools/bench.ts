/**
 * Headless performance baseline. No DOM, no canvas, fixed seed.
 *
 *   npm run bench
 *
 * Append one row per milestone and diff against the previous run. A scenario
 * regressing more than 10% without an explanation in the commit message counts
 * as a failure by the rules in ROADMAP.md section 27.
 */

import { FixedStepRunner } from '../src/core/loop';
import { Profiler } from '../src/core/perf';
import { formatMs } from '../src/core/math';
import { WORLD } from '../src/data/tuning';
import { Camera } from '../src/render/camera';
import { World } from '../src/world/world';
import { WorldGenerator } from '../src/world/gen/generator';
import { LightSystem } from '../src/world/light';
import { LiquidSystem } from '../src/world/liquid';
import { TileId } from '../src/data/tiles';
import { LiquidType } from '../src/world/world';

interface Scenario {
  readonly name: string;
  readonly ticks: number;
  readonly body: (tickIndex: number) => void;
}

interface ScenarioResult {
  readonly name: string;
  readonly ticks: number;
  readonly avg: number;
  readonly p95: number;
  readonly max: number;
  readonly totalMs: number;
  readonly perSecondSimulated: number;
}

/** Mutable sink so scenarios cannot be optimised away. */
const sink = { value: 0 };

const TICKS_PER_SECOND = 60;
const BENCH_TICKS = 6000;

function visibleWindowScenario(name: string, reachWidth: number): Scenario {
  const world = new World({ reachWidth });
  const camera = new Camera(world);
  camera.setViewport(1280, 720);
  camera.setPosition(reachWidth / 2, 0);
  return {
    name,
    ticks: BENCH_TICKS,
    body: () => {
      const view = camera.visibleRect();
      let cells = 0;
      for (let y = view.minY; y <= view.maxY; y++) {
        for (let x = view.minX; x <= view.maxX; x++) cells += world.getTile(x, y);
      }
      sink.value = (sink.value + cells) % 1_000_003;
    },
  };
}

function runScenario(scenario: Scenario): ScenarioResult {
  const runner = new FixedStepRunner();
  const profiler = new Profiler();
  const span = `bench:${scenario.name}`;

  // Warmup so the JIT has settled and the first samples are not outliers.
  const warmup = Math.min(600, scenario.ticks);
  for (let i = 0; i < warmup; i++) {
    runner.advance(1 / TICKS_PER_SECOND);
    scenario.body(i);
  }
  profiler.clearWindow();

  const start = performance.now();
  for (let i = 0; i < scenario.ticks; i++) {
    profiler.measure(span, null, () => {
      runner.advance(1 / TICKS_PER_SECOND);
      scenario.body(i);
    });
  }
  const totalMs = performance.now() - start;

  const stats = profiler.get(span);
  const simulatedSeconds = scenario.ticks / TICKS_PER_SECOND;
  return {
    name: scenario.name,
    ticks: scenario.ticks,
    avg: stats?.avg ?? 0,
    p95: stats?.p95 ?? 0,
    max: stats?.max ?? 0,
    totalMs,
    perSecondSimulated: simulatedSeconds > 0 ? totalMs / simulatedSeconds : 0,
  };
}

// M0 measures the harness itself. Real scenarios arrive with their milestones:
// world generation (M5), lighting (M7), liquid and sand (M8), entity combat (M9).
const scenarios: Scenario[] = [
  {
    name: 'loop harness overhead',
    ticks: BENCH_TICKS,
    body: () => undefined,
  },
  {
    name: 'empty scene',
    ticks: BENCH_TICKS,
    body: (i) => {
      sink.value = (sink.value + i) % 1_000_003;
    },
  },
  visibleWindowScenario('small visible window', WORLD.smallReachWidth),
  visibleWindowScenario('large visible window', WORLD.largeReachWidth),
];

const results = scenarios.map(runScenario);

const header = ['scenario', 'ticks', 'avg ms', 'p95 ms', 'max ms', 'total ms', 'ms / sim sec'];
const rows = results.map((r) => [
  r.name,
  String(r.ticks),
  formatMs(r.avg),
  formatMs(r.p95),
  formatMs(r.max),
  r.totalMs.toFixed(1),
  r.perSecondSimulated.toFixed(1),
]);

const widths = header.map((h, i) =>
  Math.max(h.length, ...rows.map((row) => (row[i] ?? '').length)),
);
const line = (cells: string[]): string =>
  cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');

console.log(`node ${process.version}  ticks/sec ${TICKS_PER_SECOND}`);
console.log(line(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of rows) console.log(line(row));
console.log(`\nsink ${sink.value}`);

// World generation is a one-shot task, so it is measured on its own.
console.log('\nworld generation');
const genSizes: Array<[string, number]> = [
  ['small', WORLD.smallReachWidth],
  ['medium', WORLD.mediumReachWidth],
  ['large', WORLD.largeReachWidth],
];
for (const [name, width] of genSizes) {
  const started = performance.now();
  const world = new WorldGenerator(20261007, width).runToCompletion();
  const genMs = performance.now() - started;
  const litStarted = performance.now();
  new LightSystem(world).fullRelight();
  const litMs = performance.now() - litStarted;
  console.log(
    `${name.padEnd(8)} ${String(width).padStart(6)}  gen ${genMs.toFixed(0)} ms  relight ${litMs.toFixed(0)} ms`,
  );
}

// 10k water cells poured into a basin: per-tick cost must stay under budget.
console.log('\nliquid (10000 cells)');
{
  const world = new World({ reachWidth: WORLD.minReachWidth });
  for (let x = 0; x < 400; x++) world.setTile(x, 300, TileId.Stone);
  for (let y = 0; y <= 300; y++) {
    world.setTile(0, y, TileId.Stone);
    world.setTile(399, y, TileId.Stone);
  }
  const liquid = new LiquidSystem(world);
  let cells = 0;
  for (let x = 100; x < 200 && cells < 10_000; x++) {
    for (let y = 200; y < 300 && cells < 10_000; y++) {
      world.setLiquid(x, y, LiquidType.Water, 100);
      cells++;
    }
  }
  liquid.rebuildActive();
  let ticks = 0;
  let maxMs = 0;
  while (liquid.activeCells > 0 && ticks < 40000) {
    const started = performance.now();
    liquid.update(2);
    maxMs = Math.max(maxMs, performance.now() - started);
    ticks++;
  }
  console.log(`${cells} cells settled in ${ticks} ticks, max ${maxMs.toFixed(2)} ms/tick`);
}
