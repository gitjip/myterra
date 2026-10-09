import { ACTIONS } from '../game/keymap';
import type { Action, KeyMap } from '../game/keymap';
import type { ModeName } from '../game/mode';
import type { Settings } from '../systems/settings';
import { TEXT } from './text';

interface NumberSettingKey {
  readonly key: keyof Settings;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const NUMBER_SETTINGS: NumberSettingKey[] = [
  { key: 'renderDistance', label: TEXT.settings.renderDistance, min: 16, max: 256, step: 8 },
  {
    key: 'simulationDistance',
    label: TEXT.settings.simulationDistance,
    min: 32,
    max: 256,
    step: 8,
  },
  { key: 'liquidBudgetMs', label: TEXT.settings.liquidBudget, min: 0.5, max: 8, step: 0.5 },
  { key: 'sandBudgetMs', label: TEXT.settings.sandBudget, min: 0.5, max: 8, step: 0.5 },
  { key: 'lightBudgetMs', label: TEXT.settings.lightBudget, min: 0.5, max: 8, step: 0.5 },
  { key: 'resolutionScale', label: TEXT.settings.resolutionScale, min: 0.5, max: 1, step: 0.05 },
  { key: 'uiScale', label: TEXT.settings.uiScale, min: 0.75, max: 2, step: 0.05 },
];

/** Settings dialog: runtime values, mode switch and key rebinding. */
export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private readonly inputs = new Map<keyof Settings, HTMLInputElement>();
  private readonly overlayToggle: HTMLInputElement;
  private readonly modeSelect: HTMLSelectElement;
  private readonly keyButtons = new Map<Action, HTMLButtonElement>();
  private listeningFor: Action | null = null;
  private current: Settings | null = null;

  public onSettingsChange: (settings: Settings) => void = () => {};
  public onModeChange: (mode: ModeName) => void = () => {};
  public onRebind: (action: Action, code: string) => void = () => {};
  public onClose: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-overlay mt-overlay--center';
    const panel = document.createElement('div');
    panel.className = 'mt-panel mt-panel--wide';

    const title = document.createElement('div');
    title.textContent = TEXT.settings.title;
    title.className = 'mt-title mt-title--panel';
    panel.append(title);

    for (const setting of NUMBER_SETTINGS) {
      const row = document.createElement('div');
      row.className = 'mt-row';
      const label = document.createElement('span');
      label.textContent = setting.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(setting.min);
      input.max = String(setting.max);
      input.step = String(setting.step);
      input.value = String(setting.max);
      input.className = 'mt-range';
      input.addEventListener('input', () => {
        this.emitNumber(setting.key, Number(input.value));
      });
      this.inputs.set(setting.key, input);
      row.append(label, input);
      panel.append(row);
    }

    const overlayRow = document.createElement('div');
    overlayRow.className = 'mt-row';
    const overlayLabel = document.createElement('span');
    overlayLabel.textContent = TEXT.settings.showOverlay;
    this.overlayToggle = document.createElement('input');
    this.overlayToggle.type = 'checkbox';
    this.overlayToggle.addEventListener('change', () => {
      this.emitOverlay();
    });
    overlayRow.append(overlayLabel, this.overlayToggle);
    panel.append(overlayRow);

    const modeRow = document.createElement('div');
    modeRow.className = 'mt-row';
    const modeLabel = document.createElement('span');
    modeLabel.textContent = TEXT.settings.mode;
    this.modeSelect = document.createElement('select');
    for (const [value, label] of [
      ['survival', TEXT.settings.survival],
      ['creative', TEXT.settings.creative],
    ] as Array<[ModeName, string]>) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.modeSelect.append(option);
    }
    this.modeSelect.addEventListener('change', () => {
      this.onModeChange(this.modeSelect.value === 'creative' ? 'creative' : 'survival');
    });
    modeRow.append(modeLabel, this.modeSelect);
    panel.append(modeRow);

    const keysTitle = document.createElement('div');
    keysTitle.textContent = TEXT.settings.keys;
    keysTitle.className = 'mt-section-title';
    panel.append(keysTitle);
    for (const action of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'mt-row';
      const label = document.createElement('span');
      label.textContent = action;
      const button = document.createElement('button');
      button.className = 'mt-button mt-button--key';
      button.addEventListener('click', () => {
        this.beginRebind(action);
      });
      this.keyButtons.set(action, button);
      row.append(label, button);
      panel.append(row);
    }

    const back = document.createElement('button');
    back.textContent = TEXT.settings.back;
    back.className = 'mt-button mt-button--spaced';
    back.addEventListener('click', () => {
      this.onClose();
    });
    panel.append(back);

    this.root.append(panel);
    parent.append(this.root);

    window.addEventListener('keydown', this.onKeyDown, true);
  }

  public get open(): boolean {
    return this.root.style.display !== 'none';
  }

  public set(open: boolean): void {
    this.root.style.display = open ? 'flex' : 'none';
    this.listeningFor = null;
  }

  public sync(settings: Settings, mode: ModeName, keymap: KeyMap): void {
    this.current = settings;
    for (const setting of NUMBER_SETTINGS) {
      const input = this.inputs.get(setting.key);
      if (input) input.value = String(settings[setting.key]);
    }
    this.overlayToggle.checked = settings.showOverlay;
    this.modeSelect.value = mode;
    for (const action of ACTIONS) {
      const button = this.keyButtons.get(action);
      if (button) button.textContent = keymap[action].join(' / ') || '—';
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.root.remove();
  }

  private beginRebind(action: Action): void {
    this.listeningFor = action;
    const button = this.keyButtons.get(action);
    if (button) button.textContent = TEXT.settings.pressKey;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.listeningFor) return;
    event.preventDefault();
    event.stopPropagation();
    const action = this.listeningFor;
    this.listeningFor = null;
    this.onRebind(action, event.code);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  private emitNumber(key: keyof Settings, value: number): void {
    if (!this.current) return;
    const next = { ...this.current, [key]: value };
    this.current = next;
    this.onSettingsChange(next);
  }

  private emitOverlay(): void {
    if (!this.current) return;
    const next = { ...this.current, showOverlay: this.overlayToggle.checked };
    this.current = next;
    this.onSettingsChange(next);
  }
}
