import { describe, it, expect } from 'vitest';
import { exportPreset, importPreset } from '@/db';

describe('preset export/import', () => {
  it('round-trips a preset through JSON', () => {
    const preset = {
      id: 'test-1',
      name: 'Test Preset',
      synthMode: 'analog' as const,
      waveform: 'sawtooth' as const,
      fmPresetIndex: 0,
      sampleName: 'piano',
      adsr: { attack: 20, decay: 100, sustain: 0.7, release: 300 },
      effects: {},
      key: 'C' as const,
      scale: 'major' as const,
      globalOctave: 0,
      buttonOctaves: [0, 0, 0, 0, 0, 0, 0],
      inversions: [0, 0, 0, 0, 0, 0, 0],
      chordLocks: [],
      bassMode: 'off' as const,
      voiceLeading: false,
      joystickMode: 'default' as const,
      drumKit: 'tight' as const,
      arpPattern: 'up' as const,
      arpRate: '1/8' as const,
      arpChordMode: 'arpOnly' as const,
      bpm: 120,
    };
    const json = exportPreset(preset as any);
    const restored = importPreset(json);
    expect(restored.name).toBe('Test Preset');
    expect(restored.key).toBe('C');
  });

  it('round-trips all fields correctly', () => {
    const preset = {
      id: 'test-2',
      name: 'Full Preset',
      synthMode: 'fm' as const,
      waveform: 'square' as const,
      fmPresetIndex: 2,
      sampleName: 'guitar',
      adsr: { attack: 5, decay: 50, sustain: 0.5, release: 200 },
      effects: { reverb: { enabled: true, value: 0.4 } },
      key: 'F#' as const,
      scale: 'dorian' as const,
      globalOctave: 1,
      buttonOctaves: [0, 1, -1, 0, 0, 0, 0],
      inversions: [0, 1, 2, 0, 0, 0, 0],
      chordLocks: [{ degree: 1 as const, direction: 'up' as const }],
      bassMode: 'root' as const,
      voiceLeading: true,
      joystickMode: 'extended' as const,
      drumKit: 'x0x' as const,
      arpPattern: 'random' as const,
      arpRate: '1/16' as const,
      arpChordMode: 'chordPlusArp' as const,
      bpm: 140,
    };
    const json = exportPreset(preset as any);
    const restored = importPreset(json);
    expect(restored).toEqual(preset);
  });

  it('rejects invalid JSON gracefully', () => {
    expect(() => importPreset('not valid json')).toThrow();
  });

  it('rejects JSON missing required preset fields', () => {
    expect(() => importPreset(JSON.stringify({ foo: 'bar' }))).toThrow();
  });
});
