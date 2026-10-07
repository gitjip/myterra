/** The smallest useful event bus. Typed by an event-name -> payload map. */

export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export type EventMap = object;

export class Emitter<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  public on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      this.off(event, listener);
    };
  }

  /** Subscribes for a single delivery. */
  public once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    const unsubscribe = this.on(event, (payload: Events[K]) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  public off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy so a listener may unsubscribe itself mid-dispatch.
    for (const listener of [...set]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  public listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  public clear(): void {
    this.listeners.clear();
  }
}
