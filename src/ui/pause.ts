import { TEXT } from './text';

/** Pause menu: Resume / Settings / Save & Exit. */
export class PausePanel {
  private readonly root: HTMLDivElement;
  public onResume: () => void = () => {};
  public onSettings: () => void = () => {};
  public onSaveExit: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-overlay mt-overlay--center';

    const panel = document.createElement('div');
    panel.className = 'mt-panel mt-panel--center';

    const title = document.createElement('div');
    title.textContent = TEXT.pause.title;
    title.className = 'mt-title mt-title--large';

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
    button.className = 'mt-button mt-button--wide';
    button.addEventListener('click', onClick);
    return button;
  }
}
