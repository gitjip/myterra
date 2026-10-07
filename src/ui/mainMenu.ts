const PANEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  background: 'radial-gradient(circle at 50% 30%, #10131f 0%, #07080d 70%)',
  color: '#d7dceb',
  font: '14px/1.5 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '2000',
};

const TITLE_STYLE: Partial<CSSStyleDeclaration> = {
  fontSize: '34px',
  letterSpacing: '6px',
  marginBottom: '12px',
  color: '#e6e9f2',
};

const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  width: '220px',
  padding: '10px 14px',
  background: '#1a1f2e',
  color: '#d7dceb',
  border: '1px solid #2a2f45',
  borderRadius: '4px',
  font: 'inherit',
  cursor: 'pointer',
};

function makeButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  Object.assign(button.style, BUTTON_STYLE);
  if (disabled) {
    button.disabled = true;
    button.style.opacity = '0.4';
    button.style.cursor = 'default';
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
    Object.assign(this.root.style, PANEL_STYLE);

    const title = document.createElement('div');
    title.textContent = 'MYTERRA';
    Object.assign(title.style, TITLE_STYLE);

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
    this.continueButton.style.opacity = available ? '1' : '0.4';
    this.continueButton.style.cursor = available ? 'pointer' : 'default';
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
