import { describe, it, expect } from 'vitest';
import { AudioEngine } from '@/audio/engine';

describe('AudioEngine', () => {
  it('creates with default state', () => {
    const engine = new AudioEngine();
    expect(engine).toBeDefined();
    expect(engine.getContext()).toBeInstanceOf(OfflineAudioContext);
  });

  it('sets master volume', () => {
    const engine = new AudioEngine();
    engine.setMasterVolume(0.5);
    expect(engine.getMasterVolume()).toBe(0.5);
  });
});
