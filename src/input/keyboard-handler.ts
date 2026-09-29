import type { ScaleDegree, JoystickDirection } from '@/music/types';

type KeyMapping =
  | { type: 'chord'; degree: ScaleDegree }
  | { type: 'direction'; dir: JoystickDirection }
  | { type: 'function'; btn: 'gray' | 'yellow' | 'red' }
  | { type: 'centerTap' }
  | { type: 'volume'; delta: number }
  | { type: 'track'; index: number }
  | { type: 'escape' }
  | { type: 'help' }
  | { type: 'looperRecord' };

const KEY_MAP: Record<string, KeyMapping> = {
  'h': { type: 'chord', degree: 1 },
  'u': { type: 'chord', degree: 2 },
  'j': { type: 'chord', degree: 3 },
  'k': { type: 'chord', degree: 4 },
  'l': { type: 'chord', degree: 5 },
  'o': { type: 'chord', degree: 6 },
  ';': { type: 'chord', degree: 7 },
  'w': { type: 'direction', dir: 'up' },
  'e': { type: 'function', btn: 'yellow' },
  'd': { type: 'direction', dir: 'right' },
  'x': { type: 'direction', dir: 'down' },
  's': { type: 'direction', dir: 'down' },
  'a': { type: 'direction', dir: 'left' },
  'arrowup': { type: 'direction', dir: 'up' },
  'arrowdown': { type: 'direction', dir: 'down' },
  'arrowleft': { type: 'direction', dir: 'left' },
  'arrowright': { type: 'direction', dir: 'right' },
  'q': { type: 'function', btn: 'gray' },
  'r': { type: 'function', btn: 'red' },
  ' ': { type: 'centerTap' },
  'enter': { type: 'looperRecord' },
  'escape': { type: 'escape' },
  '?': { type: 'help' },
  '/': { type: 'help' },
  'z': { type: 'volume', delta: -0.05 },
  'c': { type: 'volume', delta: 0.05 },
  '1': { type: 'track', index: 0 },
  '2': { type: 'track', index: 1 },
  '3': { type: 'track', index: 2 },
  '4': { type: 'track', index: 3 },
  '5': { type: 'track', index: 4 },
  '6': { type: 'track', index: 5 },
};

export function getKeyMapping(key: string): KeyMapping | null {
  return KEY_MAP[key.toLowerCase()] ?? null;
}

const DIR_VECTORS: Partial<Record<JoystickDirection, [number, number]>> = {
  up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0],
};

/** Combines held direction keys, so e.g. W+D (or ↑+→) gives the up-right diagonal. */
export function combineDirections(dirs: JoystickDirection[]): JoystickDirection {
  let x = 0;
  let y = 0;
  for (const d of dirs) {
    const v = DIR_VECTORS[d];
    if (v) { x += v[0]; y += v[1]; }
  }
  x = Math.sign(x);
  y = Math.sign(y);
  if (x === 0 && y === 0) return dirs.length > 0 ? dirs[dirs.length - 1]! : 'center';
  if (y > 0) return x > 0 ? 'upRight' : x < 0 ? 'upLeft' : 'up';
  if (y < 0) return x > 0 ? 'downRight' : x < 0 ? 'downLeft' : 'down';
  return x > 0 ? 'right' : 'left';
}

interface KeyboardCallbacks {
  onChordDown: (degree: ScaleDegree) => void;
  onChordUp: (degree: ScaleDegree) => void;
  onDirection: (dir: JoystickDirection) => void;
  onFunctionButton: (btn: 'gray' | 'yellow' | 'red', down: boolean) => void;
  onCenterTap: () => void;
  onVolumeChange: (delta: number) => void;
  onTrackToggle: (index: number) => void;
  onEscape?: () => void;
  onHelp?: () => void;
  onLooperRecord?: () => void;
}

export class KeyboardHandler {
  private callbacks: KeyboardCallbacks;
  private heldKeys = new Set<string>();
  /** Held direction keys in press order. */
  private heldDirections: string[] = [];

  constructor(callbacks: KeyboardCallbacks) {
    this.callbacks = callbacks;
  }

  attach(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  private currentDirection(): JoystickDirection {
    const dirs = this.heldDirections
      .map((k) => getKeyMapping(k))
      .filter((m): m is Extract<KeyMapping, { type: 'direction' }> => m?.type === 'direction')
      .map((m) => m.dir);
    return dirs.length === 0 ? 'center' : combineDirections(dirs);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (this.heldKeys.has(key)) return;
    this.heldKeys.add(key);

    const mapping = getKeyMapping(key);
    if (!mapping) return;

    e.preventDefault();
    switch (mapping.type) {
      case 'chord':
        this.callbacks.onChordDown(mapping.degree);
        break;
      case 'direction':
        this.heldDirections.push(key);
        this.callbacks.onDirection(this.currentDirection());
        break;
      case 'function':
        this.callbacks.onFunctionButton(mapping.btn, true);
        break;
      case 'centerTap':
        this.callbacks.onCenterTap();
        break;
      case 'volume':
        this.callbacks.onVolumeChange(mapping.delta);
        break;
      case 'track':
        this.callbacks.onTrackToggle(mapping.index);
        break;
      case 'escape':
        this.callbacks.onEscape?.();
        break;
      case 'help':
        this.callbacks.onHelp?.();
        break;
      case 'looperRecord':
        this.callbacks.onLooperRecord?.();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (!this.heldKeys.has(key)) return;
    this.heldKeys.delete(key);

    const mapping = getKeyMapping(key);
    if (!mapping) return;

    switch (mapping.type) {
      case 'chord':
        this.callbacks.onChordUp(mapping.degree);
        break;
      case 'direction':
        this.heldDirections = this.heldDirections.filter((k) => k !== key);
        this.callbacks.onDirection(this.currentDirection());
        break;
      case 'function':
        this.callbacks.onFunctionButton(mapping.btn, false);
        break;
    }
  };

  /** Losing focus drops keyups, which would leave chords stuck on. */
  private handleBlur = (): void => {
    for (const key of [...this.heldKeys]) {
      const type = getKeyMapping(key)?.type;
      if (type === 'chord' || type === 'direction') {
        this.handleKeyUp(new KeyboardEvent('keyup', { key }));
      } else {
        this.heldKeys.delete(key);
      }
    }
  };
}
