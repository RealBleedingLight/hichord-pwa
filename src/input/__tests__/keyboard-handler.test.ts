import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getKeyMapping, KeyboardHandler } from '@/input/keyboard-handler';

describe('keyboard mapping', () => {
  it('maps H to degree 1', () => {
    expect(getKeyMapping('h')).toEqual({ type: 'chord', degree: 1 });
  });

  it('maps U to degree 2', () => {
    expect(getKeyMapping('u')).toEqual({ type: 'chord', degree: 2 });
  });

  it('maps J to degree 3', () => {
    expect(getKeyMapping('j')).toEqual({ type: 'chord', degree: 3 });
  });

  it('maps W to direction up', () => {
    expect(getKeyMapping('w')).toEqual({ type: 'direction', dir: 'up' });
  });

  it('maps Space to centerTap', () => {
    expect(getKeyMapping(' ')).toEqual({ type: 'centerTap' });
  });

  it('maps Q to function gray', () => {
    expect(getKeyMapping('q')).toEqual({ type: 'function', btn: 'gray' });
  });

  it('returns null for unmapped keys', () => {
    expect(getKeyMapping('p')).toBeNull();
  });
});

function makeCallbacks() {
  return {
    onChordDown: vi.fn(),
    onChordUp: vi.fn(),
    onDirection: vi.fn(),
    onFunctionButton: vi.fn(),
    onCenterTap: vi.fn(),
    onVolumeChange: vi.fn(),
    onTrackToggle: vi.fn(),
  };
}

function dispatchKeyDown(key: string, repeat = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, repeat }));
}

function dispatchKeyUp(key: string) {
  document.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('KeyboardHandler', () => {
  let callbacks: ReturnType<typeof makeCallbacks>;
  let handler: KeyboardHandler;

  beforeEach(() => {
    callbacks = makeCallbacks();
    handler = new KeyboardHandler(callbacks);
    handler.attach();
  });

  afterEach(() => {
    handler.detach();
  });

  it('triggers onChordDown on keydown for a chord key', () => {
    dispatchKeyDown('h');
    expect(callbacks.onChordDown).toHaveBeenCalledWith(1);
  });

  it('triggers onChordUp on keyup for a chord key', () => {
    dispatchKeyDown('h');
    dispatchKeyUp('h');
    expect(callbacks.onChordUp).toHaveBeenCalledWith(1);
  });

  it('ignores repeated keydown events for the same key', () => {
    dispatchKeyDown('h');
    dispatchKeyDown('h', true);
    dispatchKeyDown('h', true);
    expect(callbacks.onChordDown).toHaveBeenCalledTimes(1);
  });

  it('does not re-trigger onChordDown while key is still held (no native repeat flag)', () => {
    dispatchKeyDown('h');
    dispatchKeyDown('h');
    expect(callbacks.onChordDown).toHaveBeenCalledTimes(1);
  });

  it('calls onDirection with the mapped direction on keydown', () => {
    dispatchKeyDown('w');
    expect(callbacks.onDirection).toHaveBeenCalledWith('up');
  });

  it('calls onDirection with center once all direction keys are released', () => {
    dispatchKeyDown('w');
    dispatchKeyUp('w');
    expect(callbacks.onDirection).toHaveBeenLastCalledWith('center');
  });

  it('does not call onDirection center while another direction key is still held', () => {
    dispatchKeyDown('w');
    dispatchKeyDown('a');
    callbacks.onDirection.mockClear();
    dispatchKeyUp('w');
    expect(callbacks.onDirection).not.toHaveBeenCalledWith('center');
    expect(callbacks.onDirection).not.toHaveBeenCalled();
  });

  it('calls onFunctionButton(true) on keydown and (false) on keyup', () => {
    dispatchKeyDown('q');
    expect(callbacks.onFunctionButton).toHaveBeenCalledWith('gray', true);
    dispatchKeyUp('q');
    expect(callbacks.onFunctionButton).toHaveBeenCalledWith('gray', false);
  });

  it('calls onCenterTap on space keydown', () => {
    dispatchKeyDown(' ');
    expect(callbacks.onCenterTap).toHaveBeenCalledTimes(1);
  });

  it('calls onVolumeChange with delta on keydown', () => {
    dispatchKeyDown('c');
    expect(callbacks.onVolumeChange).toHaveBeenCalledWith(0.05);
    dispatchKeyDown('z');
    expect(callbacks.onVolumeChange).toHaveBeenCalledWith(-0.05);
  });

  it('calls onTrackToggle with index on keydown', () => {
    dispatchKeyDown('1');
    expect(callbacks.onTrackToggle).toHaveBeenCalledWith(0);
  });

  it('does nothing for unmapped keys', () => {
    dispatchKeyDown('p');
    expect(callbacks.onChordDown).not.toHaveBeenCalled();
  });

  it('stops responding after detach', () => {
    handler.detach();
    dispatchKeyDown('h');
    expect(callbacks.onChordDown).not.toHaveBeenCalled();
  });
});
