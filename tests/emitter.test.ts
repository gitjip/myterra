import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../src/core/emitter';

interface Events {
  damage: { amount: number; target: string };
  death: { target: string };
  tick: number;
}

describe('Emitter', () => {
  it('delivers payloads to every listener', () => {
    const emitter = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on('damage', a);
    emitter.on('damage', b);
    emitter.emit('damage', { amount: 7, target: 'zombie' });
    expect(a).toHaveBeenCalledWith({ amount: 7, target: 'zombie' });
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function', () => {
    const emitter = new Emitter<Events>();
    const listener = vi.fn();
    const off = emitter.on('tick', listener);
    emitter.emit('tick', 1);
    off();
    emitter.emit('tick', 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('tick')).toBe(0);
  });

  it('once delivers exactly once', () => {
    const emitter = new Emitter<Events>();
    const listener = vi.fn();
    emitter.once('death', listener);
    emitter.emit('death', { target: 'player' });
    emitter.emit('death', { target: 'player' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('death')).toBe(0);
  });

  it('lets a listener unsubscribe itself mid-dispatch', () => {
    const emitter = new Emitter<Events>();
    const second = vi.fn();
    const first = vi.fn(() => {
      emitter.off('tick', first);
    });
    emitter.on('tick', first);
    emitter.on('tick', second);
    expect(() => {
      emitter.emit('tick', 1);
    }).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('tolerates off() for a listener that was never added', () => {
    const emitter = new Emitter<Events>();
    expect(() => {
      emitter.off('tick', vi.fn());
    }).not.toThrow();
  });

  it('emitting with no listeners is a no-op', () => {
    const emitter = new Emitter<Events>();
    expect(() => {
      emitter.emit('tick', 1);
    }).not.toThrow();
  });

  it('keeps event types independent', () => {
    const emitter = new Emitter<Events>();
    const damage = vi.fn();
    const death = vi.fn();
    emitter.on('damage', damage);
    emitter.on('death', death);
    emitter.emit('death', { target: 'slime' });
    expect(damage).not.toHaveBeenCalled();
    expect(death).toHaveBeenCalledTimes(1);
  });

  it('clear removes all listeners', () => {
    const emitter = new Emitter<Events>();
    const listener = vi.fn();
    emitter.on('tick', listener);
    emitter.on('death', listener as never);
    emitter.clear();
    emitter.emit('tick', 1);
    emitter.emit('death', { target: 'x' });
    expect(listener).not.toHaveBeenCalled();
    expect(emitter.listenerCount('tick')).toBe(0);
  });
});
