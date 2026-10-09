import { TEXT } from './text';

const OVERLAY: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(4, 6, 12, 0.72)',
  zIndex: '2550',
  font: '14px/1.6 ui-monospace, Menlo, Consolas, monospace',
  color: '#d7dceb',
};

const BUTTON: Partial<CSSStyleDeclaration> = {
  width: '220px',
  padding: '10px 14px',
  background: '#1a1f2e',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '4px',
  font: 'inherit',
  cursor: 'pointer',
};

/** Pause menu: Resume / Settings / Save & Exit. */
export class PausePanel {
  private readonly root: HTMLDivElement;
  public onResume: () => void = () => {};
  public onSettings: () => void = () => {};
  public onSaveExit: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, OVERLAY);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      padding: '26px 30px',
      background: 'rgba(10, 12, 20, 0.97)',
      border: '1px solid #2a2f45',
      borderRadius: '6px',
    } satisfies Partial<CSSStyleDeclaration>);

    const title = document.createElement('div');
    title.textContent = TEXT.pause.title;
    Object.assign(title.style, { fontSize: '24px', letterSpacing: '4px', marginBottom: '6px' });

    panel.append(
      title,
      this.button(TEXT.pause.resume, () => {
        this.onResume();
      }),
      this.button(TEXT.pause.settings, () => {
        this.onSettings();
      }),
      this.button(TEXT.pause.saveExit, () => {
        this.onSaveExit();
      }),
    );
    this.root.append(panel);
    parent.append(this.root);
  }

  public get open(): boolean {
    return this.root.style.display !== 'none';
  }

  public set(open: boolean): void {
    this.root.style.display = open ? 'flex' : 'none';
  }

  public dispose(): void {
    this.root.remove();
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    Object.assign(button.style, BUTTON);
    button.addEventListener('click', onClick);
    return button;
  }
}
