import { TEXT } from '../ui/text';
import { IS_DEV } from './env';

/**
 * Bottom-docked command prompt. Opens with the backquote key. Keeps a small
 * scrollback and a command history (up/down), and stops key events from
 * reaching the game while focused.
 */
export class ConsolePanel {
  private readonly root: HTMLDivElement;
  private readonly log: HTMLPreElement;
  private readonly input: HTMLInputElement;
  private readonly history: string[] = [];
  private historyIndex = 0;
  private openState = false;

  public onCommand: (line: string) => string | null = () => null;

  public constructor(private readonly parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-console';

    this.log = document.createElement('pre');
    this.log.className = 'mt-console__log';

    const line = document.createElement('div');
    line.className = 'mt-console__line';
    const prompt = document.createElement('span');
    prompt.className = 'mt-console__prompt';
    prompt.textContent = '>';
    this.input = document.createElement('input');
    this.input.className = 'mt-console__input';
    this.input.type = 'text';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    line.append(prompt, this.input);

    this.root.append(this.log, line);
    this.parent.append(this.root);

    this.input.addEventListener('keydown', (event) => { this.onInputKey(event); });
    // Keep game hotkeys (digits, E, C, ...) from firing while typing.
    this.input.addEventListener('keydown', (event) => { event.stopPropagation(); });
    this.print(TEXT.dev.consoleHint);
  }

  public get open(): boolean {
    return this.openState;
  }

  public toggle(force?: boolean): void {
    this.openState = force ?? !this.openState;
    this.root.style.display = this.openState ? 'flex' : 'none';
    if (this.openState) this.input.focus();
    else this.input.blur();
  }

  public print(text: string, error = false): void {
    const line = document.createElement('div');
    line.textContent = text;
    if (error) line.className = 'mt-console__error';
    this.log.append(line, document.createTextNode('\n'));
    this.log.scrollTop = this.log.scrollHeight;
  }

  public dispose(): void {
    this.root.remove();
  }

  private onInputKey(event: KeyboardEvent): void {
    if (event.code === 'Backquote') {
      event.preventDefault();
      this.toggle(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.toggle(false);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.recall(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.recall(1);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      this.input.value = this.complete(this.input.value);
    }
  }

  private submit(): void {
    const line = this.input.value.trim();
    this.input.value = '';
    if (line.length === 0) return;
    this.history.push(line);
    this.historyIndex = this.history.length;
    this.print(`> ${line}`);
    const result = this.onCommand(line);
    if (result !== null) this.print(result, result.startsWith('unknown') || result.startsWith('error'));
  }

  private recall(direction: number): void {
    if (this.history.length === 0) return;
    this.historyIndex = Math.min(
      this.history.length,
      Math.max(0, this.historyIndex + direction),
    );
    this.input.value =
      this.historyIndex >= this.history.length ? '' : (this.history[this.historyIndex] ?? '');
  }

  /** Placeholder completion hook; commands may replace it. */
  public completer: (prefix: string) => string = (prefix) => prefix;

  private complete(prefix: string): string {
    if (!IS_DEV) return prefix;
    return this.completer(prefix);
  }
}
