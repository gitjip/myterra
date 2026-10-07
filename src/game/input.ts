import type { Action, KeyMap, KeyValueStore } from './keymap';
import { loadKeymap, remap as remapKeymap, saveKeymap } from './keymap';

export interface MouseState {
  /** Pointer position relative to the canvas, in CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly inside: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly middle: boolean;
}

export interface InputState {
  readonly moveX: -1 | 0 | 1;
  readonly moveY: -1 | 0 | 1;
  readonly jump: boolean;
  readonly mouse: MouseState;
}

function defaultStorage(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Keyboard and mouse plumbing. It only reports intent; gameplay decides what to
 * do with it. Mouse buttons are tracked now so mining/placing in M3 can read
 * them without touching this class.
 */
export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly storage: KeyValueStore | null;
  private readonly held = new Set<string>();
  private keymapValue: KeyMap;
  private mouseX = 0;
  private mouseY = 0;
  private mouseInside = false;
  private leftDown = false;
  private rightDown = false;
  private middleDown = false;
  private readonly pressed = new Set<'left' | 'right' | 'middle'>();
  private wheelAccum = 0;
  private readonly disposers: Array<() => void> = [];

  public constructor(canvas: HTMLCanvasElement, storage: KeyValueStore | null = defaultStorage()) {
    this.canvas = canvas;
    this.storage = storage;
    this.keymapValue = loadKeymap(storage);
    this.bind();
  }

  public get keymap(): KeyMap {
    return this.keymapValue;
  }

  public get state(): InputState {
    const left = this.isHeld('left');
    const right = this.isHeld('right');
    const up = this.isHeld('up');
    const down = this.isHeld('down');
    return {
      moveX: right === left ? 0 : right ? 1 : -1,
      moveY: down === up ? 0 : down ? 1 : -1,
      jump: this.isHeld('jump'),
      mouse: {
        x: this.mouseX,
        y: this.mouseY,
        inside: this.mouseInside,
        left: this.leftDown,
        right: this.rightDown,
        middle: this.middleDown,
      },
    };
  }

  public remap(action: Action, code: string): void {
    this.keymapValue = remapKeymap(this.keymapValue, action, code);
    saveKeymap(this.keymapValue, this.storage);
  }

  /**
   * Returns true once per button-down, consuming the queued press. Because the
   * fixed update can run zero or several times per rendered frame, presses are
   * queued rather than sampled from a previous-frame diff.
   */
  public consumePress(button: 'left' | 'right' | 'middle'): boolean {
    return this.pressed.delete(button);
  }

  /** Accumulated wheel delta since the last call, then reset. */
  public consumeWheel(): number {
    const delta = this.wheelAccum;
    this.wheelAccum = 0;
    return delta;
  }

  public dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.held.clear();
  }

  private isHeld(action: Action): boolean {
    return this.keymapValue[action].some((code) => this.held.has(code));
  }

  private bind(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
      this.held.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.held.delete(event.code);
    };
    const onBlur = (): void => {
      this.held.clear();
      this.pressed.clear();
      this.leftDown = false;
      this.rightDown = false;
      this.middleDown = false;
    };
    const onMouseMove = (event: MouseEvent): void => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
      this.mouseInside =
        this.mouseX >= 0 &&
        this.mouseY >= 0 &&
        this.mouseX <= rect.width &&
        this.mouseY <= rect.height;
    };
    const onMouseDown = (event: MouseEvent): void => {
      if (event.button === 0) {
        this.leftDown = true;
        this.pressed.add('left');
      } else if (event.button === 1) {
        this.middleDown = true;
        this.pressed.add('middle');
      } else if (event.button === 2) {
        this.rightDown = true;
        this.pressed.add('right');
      }
    };
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button === 0) this.leftDown = false;
      else if (event.button === 1) this.middleDown = false;
      else if (event.button === 2) this.rightDown = false;
    };
    const onMouseLeave = (): void => {
      this.mouseInside = false;
    };
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      this.wheelAccum += event.deltaY;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.canvas.addEventListener('mousemove', onMouseMove);
    this.canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    this.canvas.addEventListener('mouseleave', onMouseLeave);
    this.canvas.addEventListener('contextmenu', onContextMenu);
    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      this.canvas.removeEventListener('mousemove', onMouseMove);
      this.canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      this.canvas.removeEventListener('mouseleave', onMouseLeave);
      this.canvas.removeEventListener('contextmenu', onContextMenu);
      this.canvas.removeEventListener('wheel', onWheel);
    });
  }
}
