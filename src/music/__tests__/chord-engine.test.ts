import { describe, it, expect } from 'vitest';
import { getDiatonicChord } from '@/music/chord-engine';

describe('chord-engine', () => {
  it('returns C major triad for degree 1 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4);
    expect(chord.quality).toBe('major');
    expect(chord.displayName).toBe('C');
    expect(chord.notes.map((n) => n.name)).toEqual(['C4', 'E4', 'G4']);
  });

  it('returns D minor triad for degree 2 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 2, 4);
    expect(chord.quality).toBe('minor');
    expect(chord.displayName).toBe('Dm');
    expect(chord.notes.map((n) => n.name)).toEqual(['D4', 'F4', 'A4']);
  });

  it('returns B diminished for degree 7 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 7, 4);
    expect(chord.quality).toBe('diminished');
    expect(chord.displayName).toBe('Bdim');
  });

  it('returns G major triad for degree 1 in G major', () => {
    const chord = getDiatonicChord('G', 'major', 1, 4);
    expect(chord.quality).toBe('major');
    expect(chord.displayName).toBe('G');
    expect(chord.notes.map((n) => n.name)).toEqual(['G4', 'B4', 'D5']);
  });

  it('returns correct qualities for all 7 degrees in major', () => {
    const qualities = [1, 2, 3, 4, 5, 6, 7].map(
      (d) => getDiatonicChord('C', 'major', d as any, 4).quality
    );
    expect(qualities).toEqual([
      'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
    ]);
  });

  it('returns notes with correct frequencies', () => {
    const chord = getDiatonicChord('A', 'major', 1, 4);
    expect(chord.notes[0].frequency).toBeCloseTo(440, 0);
  });

  it('supports first inversion', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4, 1);
    expect(chord.inversion).toBe(1);
    expect(chord.notes[0].name).toBe('E4');
    expect(chord.notes[1].name).toBe('G4');
    expect(chord.notes[2].name).toBe('C5');
  });

  it('supports second inversion', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4, 2);
    expect(chord.inversion).toBe(2);
    expect(chord.notes[0].name).toBe('G4');
    expect(chord.notes[1].name).toBe('C5');
    expect(chord.notes[2].name).toBe('E5');
  });
});
