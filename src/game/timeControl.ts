/**
 * Dev pause/step control. Pausing freezes the fixed update while rendering
 * continues; queued steps run one fixed update each, so behaviour can be
 * inspected frame by frame. Pure and clock-free for testing.
 */
export class TimeControl {
  private paused = false;
  private pendingSteps = 0;

  public get isPaused(): boolean {
    return this.paused;
  }

  public get stepsRemaining(): number {
    return this.pendingSteps;
  }

  public setPaused(on: boolean): void {
    this.paused = on;
    if (!on) this.pendingSteps = 0;
  }

  public toggle(): boolean {
    this.setPaused(!this.paused);
    return this.paused;
  }

  /** Queues `count` fixed updates and pauses. */
  public requestStep(count = 1): void {
    this.paused = true;
    this.pendingSteps += Math.max(0, Math.trunc(count));
  }

  /** True when a fixed step should run now, consuming a queued step. */
  public shouldStep(): boolean {
    if (!this.paused) return true;
    if (this.pendingSteps > 0) {
      this.pendingSteps--;
      return true;
    }
    return false;
  }
}
