function makeButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = 'mt-button mt-button--wide';
  if (disabled) {
    button.disabled = true;
  } else {
    button.addEventListener('click', onClick);
  }
  return button;
}

/** Title screen. Continue is enabled once a saved world exists. */
export class MainMenu {
  private readonly root: HTMLDivElement;
  private readonly continueButton: HTMLButtonElement;
  public onNewWorld: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-overlay mt-overlay--menu';

    const title = document.createElement('div');
    title.textContent = 'MYTERRA';
    title.className = 'mt-title mt-title--hero';

    this.continueButton = makeButton('Continue', () => undefined, true);

    this.root.append(
      title,
      makeButton('New World', () => {
        this.onNewWorld();
      }),
      this.continueButton,
      makeButton('Settings', () => undefined, true),
      makeButton('Credits', () => undefined, true),
    );
    parent.append(this.root);
  }

  /** Enables Continue and points it at the most recent world. */
  public setContinue(available: boolean, onClick: () => void): void {
    this.continueButton.disabled = !available;
    this.continueButton.onclick = available ? onClick : null;
  }

  public show(): void {
    this.root.style.display = 'flex';
  }

  public hide(): void {
    this.root.style.display = 'none';
  }

  public dispose(): void {
    this.root.remove();
  }
}
