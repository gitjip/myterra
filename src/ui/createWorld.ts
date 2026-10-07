import { seedFromString } from '../core/rng';
import { estimateWorldMemoryMb, WORLD } from '../data/tuning';
import type { ModeName } from '../game/mode';

export interface WorldConfig {
  readonly name: string;
  readonly seed: number;
  readonly reachWidth: number;
  readonly mode: ModeName;
}

const PANEL: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at 50% 30%, #10131f 0%, #07080d 70%)',
  color: '#d7dceb',
  font: '14px/1.6 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '2000',
};

const INPUT: Partial<CSSStyleDeclaration> = {
  width: '220px',
  padding: '6px 8px',
  background: '#0e1220',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '3px',
  font: 'inherit',
};

const BUTTON: Partial<CSSStyleDeclaration> = {
  padding: '8px 18px',
  background: '#1a1f2e',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '4px',
  font: 'inherit',
  cursor: 'pointer',
};

/** New-world dialog: name, size, seed and mode, then a generation progress bar. */
export class CreateWorldScreen {
  private readonly root: HTMLDivElement;
  private readonly form: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly sizeSelect: HTMLSelectElement;
  private readonly customInput: HTMLInputElement;
  private readonly customRow: HTMLDivElement;
  private readonly seedInput: HTMLInputElement;
  private readonly modeSelect: HTMLSelectElement;
  private readonly memory: HTMLDivElement;
  private readonly progressTrack: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly cancelGenerating: HTMLButtonElement;
  private readonly createButton: HTMLButtonElement;

  public onStart: (config: WorldConfig) => void = () => {};
  public onCancel: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, PANEL);

    this.form = document.createElement('div');
    Object.assign(this.form.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '22px 26px',
      background: 'rgba(10, 12, 20, 0.9)',
      border: '1px solid #2a2f45',
      borderRadius: '6px',
    });

    this.nameInput = this.textInput('My World');
    this.sizeSelect = document.createElement('select');
    Object.assign(this.sizeSelect.style, INPUT);
    for (const [label, width] of [
      ['Small', WORLD.smallReachWidth],
      ['Medium', WORLD.mediumReachWidth],
      ['Large', WORLD.largeReachWidth],
      ['Custom', 0],
    ] as Array<[string, number]>) {
      const option = document.createElement('option');
      option.value = String(width);
      option.textContent = label;
      this.sizeSelect.append(option);
    }
    this.sizeSelect.value = String(WORLD.mediumReachWidth);

    this.customInput = this.textInput(String(WORLD.mediumReachWidth));
    this.customInput.type = 'number';
    this.customInput.min = String(WORLD.minReachWidth);
    this.customInput.max = String(WORLD.maxReachWidth);
    this.customRow = this.row('Custom width', this.customInput);
    this.customRow.style.display = 'none';

    this.seedInput = this.textInput('');
    this.seedInput.placeholder = 'random';
    this.modeSelect = document.createElement('select');
    Object.assign(this.modeSelect.style, INPUT);
    for (const [label, value] of [
      ['Survival', 'survival'],
      ['Creative', 'creative'],
    ] as Array<[string, string]>) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.modeSelect.append(option);
    }

    this.memory = document.createElement('div');
    Object.assign(this.memory.style, { color: '#8b93b0', fontSize: '12px' });

    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', gap: '10px', marginTop: '6px' });
    this.createButton = document.createElement('button');
    this.createButton.textContent = 'Create';
    Object.assign(this.createButton.style, BUTTON);
    this.createButton.addEventListener('click', () => {
      this.submit();
    });
    const cancel = document.createElement('button');
    cancel.textContent = 'Back';
    Object.assign(cancel.style, BUTTON);
    cancel.addEventListener('click', () => {
      this.onCancel();
    });
    buttons.append(this.createButton, cancel);

    this.form.append(
      this.row('World name', this.nameInput),
      this.row('Size', this.sizeSelect),
      this.customRow,
      this.row('Seed', this.seedInput),
      this.row('Game mode', this.modeSelect),
      this.memory,
      buttons,
    );

    this.progressTrack = document.createElement('div');
    Object.assign(this.progressTrack.style, {
      width: '260px',
      height: '12px',
      marginTop: '16px',
      background: '#0e1220',
      border: '1px solid #2a2f45',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'none',
    });
    this.progressFill = document.createElement('div');
    Object.assign(this.progressFill.style, {
      width: '0%',
      height: '100%',
      background: '#4aa3e0',
    });
    this.progressTrack.append(this.progressFill);

    this.status = document.createElement('div');
    Object.assign(this.status.style, { marginTop: '10px', color: '#8b93b0' });

    this.cancelGenerating = document.createElement('button');
    this.cancelGenerating.textContent = 'Cancel';
    Object.assign(this.cancelGenerating.style, BUTTON);
    this.cancelGenerating.style.marginTop = '12px';
    this.cancelGenerating.style.display = 'none';
    this.cancelGenerating.addEventListener('click', () => {
      this.onCancel();
    });

    this.root.append(this.form, this.progressTrack, this.status, this.cancelGenerating);

    this.sizeSelect.addEventListener('change', () => {
      this.refreshMemory();
    });
    this.customInput.addEventListener('input', () => {
      this.refreshMemory();
    });

    parent.append(this.root);
  }

  public show(): void {
    this.root.style.display = 'flex';
    this.form.style.display = 'flex';
    this.progressTrack.style.display = 'none';
    this.cancelGenerating.style.display = 'none';
    this.createButton.disabled = false;
    this.status.textContent = '';
    this.refreshMemory();
  }

  public hide(): void {
    this.root.style.display = 'none';
  }

  public setGenerating(active: boolean, seed: number): void {
    if (active) {
      this.form.style.display = 'none';
      this.progressTrack.style.display = 'block';
      this.cancelGenerating.style.display = 'block';
      this.status.textContent = `Generating world with seed ${seed}...`;
    } else {
      this.createButton.disabled = false;
      this.cancelGenerating.style.display = 'none';
    }
  }

  public setProgress(fraction: number): void {
    this.progressFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  public dispose(): void {
    this.root.remove();
  }

  private submit(): void {
    const custom = Number(this.customInput.value);
    const chosen = Number(this.sizeSelect.value);
    const reachWidth = chosen > 0 ? chosen : clampWidth(custom);
    const rawSeed = this.seedInput.value.trim();
    const seed = rawSeed.length > 0 ? seedFromString(rawSeed) : randomSeed();
    this.onStart({
      name: this.nameInput.value.trim() || 'My World',
      seed,
      reachWidth,
      mode: this.modeSelect.value === 'creative' ? 'creative' : 'survival',
    });
  }

  private refreshMemory(): void {
    const custom = Number(this.customInput.value);
    const chosen = Number(this.sizeSelect.value);
    const width = chosen > 0 ? chosen : clampWidth(custom);
    this.customRow.style.display = chosen > 0 ? 'none' : 'flex';
    this.memory.textContent = `Estimated grid memory: ~${estimateWorldMemoryMb(width).toFixed(0)} MB`;
  }

  private row(label: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '12px' });
    const text = document.createElement('span');
    text.textContent = label;
    Object.assign(text.style, { width: '110px', color: '#8b93b0' });
    row.append(text, control);
    return row;
  }

  private textInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    Object.assign(input.style, INPUT);
    return input;
  }
}

function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return WORLD.mediumReachWidth;
  return Math.min(WORLD.maxReachWidth, Math.max(WORLD.minReachWidth, Math.round(width)));
}

function randomSeed(): number {
  return (Math.random() * 0x1_0000_0000) >>> 0;
}
