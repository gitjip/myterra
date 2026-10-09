/** Death overlay with Respawn and Exit actions. */
export class DeathPanel {
  private readonly root: HTMLDivElement;
  public onRespawn: () => void = () => {};
  public onExit: () => void = () => {};

  public constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mt-overlay mt-overlay--center mt-overlay--column mt-overlay--death';

    const title = document.createElement('div');
    title.textContent = 'YOU DIED';
    title.className = 'mt-title mt-title--death';

    const respawn = document.createElement('button');
    respawn.textContent = 'Respawn';
    respawn.className = 'mt-button mt-button--danger mt-button--death';
    respawn.addEventListener('click', () => {
      this.onRespawn();
    });

    const exit = document.createElement('button');
    exit.textContent = 'Exit to Menu';
    exit.className = 'mt-button mt-button--danger mt-button--death';
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
