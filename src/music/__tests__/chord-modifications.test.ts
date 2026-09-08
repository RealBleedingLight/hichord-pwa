import { describe, it, expect } from 'vitest';
import { modifyChord, getChord } from '@/music/chord-engine';
import { getDiatonicChord } from '@/music/chord-engine';

describe('joystick modifications — default mode', () => {
  it('flips major to minor on "up"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'up', 'default');
    expect(modified.quality).toBe('minor');
    expect(modified.displayName).toBe('Cm');
  });

  it('adds dom7 on "upRight"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'upRight', 'default');
    expect(modified.quality).toBe('dom7');
    expect(modified.notes).toHaveLength(4);
  });

  it('adds maj7 on "right"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'right', 'default');
    expect(modified.quality).toBe('maj7');
  });

  it('adds ninth on "downRight"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'downRight', 'default');
    expect(modified.quality).toBe('ninth');
  });

  it('adds sus4 on "down"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'down', 'default');
    expect(modified.quality).toBe('sus4');
  });

  it('adds sixth on "downLeft"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'downLeft', 'default');
    expect(modified.quality).toBe('sixth');
  });

  it('makes diminished on "left"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'left', 'default');
    expect(modified.quality).toBe('diminished');
  });

  it('makes augmented on "upLeft"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'upLeft', 'default');
    expect(modified.quality).toBe('augmented');
  });

  it('returns unchanged on "center"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'center', 'default');
    expect(modified.quality).toBe('major');
  });
});

describe('getChord — full pipeline', () => {
  it('applies chord lock', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'off', [
      { degree: 1, direction: 'upRight' },
    ]);
    expect(chord.quality).toBe('dom7');
  });

  it('adds bass note in root bass mode', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'root', []);
    expect(chord.bass).not.toBeNull();
    expect(chord.bass!.name).toBe('C3');
  });

  it('applies inversion', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 1, 'off', []);
    expect(chord.inversion).toBe(1);
    expect(chord.notes[0].name).toBe('E4');
  });
});
