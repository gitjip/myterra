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
// world generation (M4), lighting (M6), liquid and sand (M7), entity combat (M8).
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
