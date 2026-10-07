const OVERLAY: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0',
  display: 'none',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  background: 'rgba(20, 4, 6, 0.72)',
  color: '#f0d7d7',
  font: '15px/1.6 ui-monospace, Menlo, Consolas, monospace',
  zIndex: '2500',
};

const BUTTON: Partial<CSSStyleDeclaration> = {
  width: '200px',
  padding: '10px 14px',
  background: '#2a1416',
  color: '#f0d7d7',
  border: '1px solid #5a2a2e',
  borderRadius: '4px',
  font: 'inherit',
  cursor: 'pointer',
};

/** Death overlay with Respawn and Exit actions. */
export class DeathPanel {
  private readonly root: HTMLDivElement;
  public onRespawn: () => void = () => {};
  public onExit: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, OVERLAY);

    const title = document.createElement('div');
    title.textContent = 'YOU DIED';
    Object.assign(title.style, { fontSize: '32px', letterSpacing: '6px' });

    const respawn = document.createElement('button');
    respawn.textContent = 'Respawn';
    Object.assign(respawn.style, BUTTON);
    respawn.addEventListener('click', () => {
      this.onRespawn();
    });

    const exit = document.createElement('button');
    exit.textContent = 'Exit to Menu';
    Object.assign(exit.style, BUTTON);
    exit.addEventListener('click', () => {
      this.onExit();
    });

    this.root.append(title, respawn, exit);
    parent.append(this.root);
  }

  public get open(): boolean {
    return this.root.style.display !== 'none';
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
