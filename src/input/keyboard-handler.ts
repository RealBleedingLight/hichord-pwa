import type { ScaleDegree, JoystickDirection } from '@/music/types';

type KeyMapping =
  | { type: 'chord'; degree: ScaleDegree }
  | { type: 'direction'; dir: JoystickDirection }
  | { type: 'function'; btn: 'gray' | 'yellow' | 'red' }
  | { type: 'centerTap' }
  | { type: 'volume'; delta: number }
  | { type: 'track'; index: number };

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
  'q': { type: 'function', btn: 'gray' },
  'r': { type: 'function', btn: 'red' },
  ' ': { type: 'centerTap' },
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

interface KeyboardCallbacks {
  onChordDown: (degree: ScaleDegree) => void;
  onChordUp: (degree: ScaleDegree) => void;
  onDirection: (dir: JoystickDirection) => void;
  onFunctionButton: (btn: 'gray' | 'yellow' | 'red', down: boolean) => void;
  onCenterTap: () => void;
  onVolumeChange: (delta: number) => void;
  onTrackToggle: (index: number) => void;
}

export class KeyboardHandler {
  private callbacks: KeyboardCallbacks;
  private heldKeys = new Set<string>();
  private heldDirections = new Set<string>();

  constructor(callbacks: KeyboardCallbacks) {
    this.callbacks = callbacks;
  }

  attach(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
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
        this.heldDirections.add(key);
        this.callbacks.onDirection(mapping.dir);
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
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.heldKeys.delete(key);

    const mapping = getKeyMapping(key);
    if (!mapping) return;

    switch (mapping.type) {
      case 'chord':
        this.callbacks.onChordUp(mapping.degree);
        break;
      case 'direction':
        this.heldDirections.delete(key);
        if (this.heldDirections.size === 0) {
          this.callbacks.onDirection('center');
        }
        break;
      case 'function':
        this.callbacks.onFunctionButton(mapping.btn, false);
        break;
    }
  };
}
