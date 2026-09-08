import { describe, it, expect } from 'vitest';
import { getScaleIntervals, getScaleNotes, midiToFrequency, midiToNoteName } from '@/music/scales';

describe('scales', () => {
  it('returns major scale intervals', () => {
    expect(getScaleIntervals('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('returns natural minor scale intervals', () => {
    expect(getScaleIntervals('naturalMinor')).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('returns blues scale intervals', () => {
    expect(getScaleIntervals('blues')).toEqual([0, 3, 5, 6, 7, 10]);
  });

  it('returns C major scale MIDI notes starting at C4', () => {
    const notes = getScaleNotes('C', 'major', 4);
    expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });

  it('returns G major scale MIDI notes', () => {
    const notes = getScaleNotes('G', 'major', 4);
    expect(notes).toEqual([67, 69, 71, 72, 74, 76, 78]);
  });

  it('converts MIDI 69 to 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2);
  });

  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('converts MIDI 61 to C#4', () => {
    expect(midiToNoteName(61)).toBe('C#4');
  });
});
