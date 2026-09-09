import { describe, it, expect } from 'vitest';
import { getChord } from '@/music/chord-engine';
import { getScaleNotes } from '@/music/scales';
import { calculateLoopLength } from '@/audio/looper';
import { DRUM_PATTERNS } from '@/data/drum-patterns';
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';

describe('integration', () => {
  it('generates valid chords for all keys and degrees', () => {
    for (const key of ALL_KEYS) {
      for (let degree = 1; degree <= 7; degree++) {
        const chord = getChord(key, 'major', degree as any, 4, 'center', 'default', 0, 'off', []);
        expect(chord.notes.length).toBeGreaterThanOrEqual(3);
        expect(chord.displayName.length).toBeGreaterThan(0);
        for (const note of chord.notes) {
          expect(note.frequency).toBeGreaterThan(0);
          expect(note.midi).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('generates valid chords for all joystick directions and modes', () => {
    const directions = ['up', 'upRight', 'right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'center'] as const;
    const modes = ['default', 'extended', 'chromatic'] as const;
    for (const mode of modes) {
      for (const dir of directions) {
        const chord = getChord('C', 'major', 1, 4, dir, mode, 0, 'off', []);
        expect(chord.notes.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('loop length calculation works for all reasonable BPMs', () => {
    for (let bpm = 40; bpm <= 300; bpm += 10) {
      for (let bars = 1; bars <= 8; bars++) {
        const samples = calculateLoopLength(bars, bpm, 48000);
        expect(samples).toBeGreaterThan(0);
        expect(Number.isInteger(samples)).toBe(true);
      }
    }
  });

  it('has drum patterns for all genres', () => {
    const genres = ['Rock', 'Disco', 'Reggae', 'Funk', 'Hip-Hop', 'Electro', 'Jazz'];
    for (const genre of genres) {
      const patterns = DRUM_PATTERNS.filter((p) => p.genre === genre);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('store mode transitions work', () => {
    const store = useAppStore.getState();
    store.setPlayMode('arpeggio');
    expect(useAppStore.getState().playMode).toBe('arpeggio');
    store.setPlayMode('drum');
    expect(useAppStore.getState().playMode).toBe('drum');
    store.setPlayMode('play');
  });
});
