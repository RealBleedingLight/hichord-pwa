import { describe, it, expect } from 'vitest';
import { ALL_KEYS, SCALE_DEGREES } from '@/music/types';
import { ADSR_PRESETS, FM_PRESETS, STRUM_INTERVALS } from '@/audio/types';
import { useAppStore } from '@/store';

describe('music types', () => {
  it('has 12 keys', () => {
    expect(ALL_KEYS).toHaveLength(12);
    expect(ALL_KEYS[0]).toBe('C');
    expect(ALL_KEYS[11]).toBe('B');
  });

  it('has 7 scale degrees', () => {
    expect(SCALE_DEGREES).toHaveLength(7);
    expect(SCALE_DEGREES[0]).toBe(1);
    expect(SCALE_DEGREES[6]).toBe(7);
  });
});

describe('audio types', () => {
  it('has 6 ADSR presets', () => {
    expect(Object.keys(ADSR_PRESETS)).toHaveLength(6);
    expect(ADSR_PRESETS.PLUCK.attack).toBe(5);
    expect(ADSR_PRESETS.LONG.release).toBe(2000);
  });

  it('has 5 FM presets', () => {
    expect(FM_PRESETS).toHaveLength(5);
    expect(FM_PRESETS[0].name).toBe('FM EPiano');
  });

  it('has 3 strum speeds', () => {
    expect(STRUM_INTERVALS.slow).toBe(80);
    expect(STRUM_INTERVALS.fast).toBe(15);
  });
});

describe('store', () => {
  it('has correct defaults', () => {
    const state = useAppStore.getState();
    expect(state.key).toBe('C');
    expect(state.scale).toBe('major');
    expect(state.bpm).toBe(120);
    expect(state.playMode).toBe('play');
    expect(state.synthMode).toBe('analog');
    expect(state.looperTracks).toHaveLength(6);
    expect(state.volume).toBe(0.8);
  });

  it('clamps BPM to 40-300', () => {
    useAppStore.getState().setBpm(10);
    expect(useAppStore.getState().bpm).toBe(40);
    useAppStore.getState().setBpm(500);
    expect(useAppStore.getState().bpm).toBe(300);
    useAppStore.getState().setBpm(120);
  });

  it('clamps volume to 0-1', () => {
    useAppStore.getState().setVolume(-0.5);
    expect(useAppStore.getState().volume).toBe(0);
    useAppStore.getState().setVolume(1.5);
    expect(useAppStore.getState().volume).toBe(1);
    useAppStore.getState().setVolume(0.8);
  });
});
