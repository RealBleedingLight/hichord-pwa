import { describe, it, expect } from 'vitest';
import { getChord, getDegreeLabels, directionLabel, romanNumeral } from '@/music/chord-engine';
import type { ScaleDegree, ScaleName } from '@/music/types';

describe('non-heptatonic scales', () => {
  const scales: ScaleName[] = ['majorPentatonic', 'minorPentatonic', 'blues'];
  for (const scale of scales) {
    it(`${scale}: every chord button produces real notes`, () => {
      for (const degree of [1, 2, 3, 4, 5, 6, 7] as ScaleDegree[]) {
        const chord = getChord('A', scale, degree, 4, 'center', 'default', 0, 'root', []);
        for (const n of [...chord.notes, chord.bass!]) {
          expect(Number.isFinite(n.frequency)).toBe(true);
        }
        expect(chord.displayName).not.toMatch(/undefined|NaN/);
      }
    });
  }

  it('minor pentatonic harmonises from natural minor', () => {
    expect(getDegreeLabels('A', 'minorPentatonic').map((l) => l.name))
      .toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  });
});

describe('chord labels', () => {
  it('names the 7 chords of C major with roman numerals', () => {
    expect(getDegreeLabels('C', 'major')).toEqual([
      { name: 'C', roman: 'I' }, { name: 'Dm', roman: 'ii' }, { name: 'Em', roman: 'iii' },
      { name: 'F', roman: 'IV' }, { name: 'G', roman: 'V' }, { name: 'Am', roman: 'vi' },
      { name: 'Bdim', roman: 'vii°' },
    ]);
  });

  it('marks augmented chords', () => {
    expect(romanNumeral(3, 'augmented')).toBe('III+');
  });

  it('uses readable suffixes for extended chords', () => {
    expect(getChord('C', 'major', 5, 4, 'upRight', 'extended', 0, 'off', []).displayName).toBe('G9');
    expect(getChord('C', 'major', 1, 4, 'right', 'chromatic', 0, 'off', []).displayName).toBe('C6/9');
    expect(getChord('C', 'major', 5, 4, 'left', 'extended', 0, 'off', []).displayName).toBe('G7sus4');
  });

  it('labels pad directions per joystick mode', () => {
    expect(directionLabel('up', 'default')).toBe('maj↔min');
    expect(directionLabel('right', 'default')).toBe('maj7');
    expect(directionLabel('upLeft', 'default')).toBe('aug');
    expect(directionLabel('down', 'extended')).toBe('7♯9');
    expect(directionLabel('center', 'default')).toBe('');
  });

  it('slash bass mode puts the fifth under the root', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'slash', []);
    expect(chord.bass!.name).toBe('G3');
  });
});
