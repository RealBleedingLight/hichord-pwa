import { describe, it, expect } from 'vitest';
import { Arpeggiator } from '@/audio/arpeggiator';
import type { ChordVoicing } from '@/music/types';

const mockChord: ChordVoicing = {
  notes: [
    { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
    { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
  ],
  bass: null,
  quality: 'major',
  rootName: 'C',
  displayName: 'C',
  inversion: 0,
};

describe('Arpeggiator', () => {
  it('cycles up through chord notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('up');

    expect(arp.getNextNote(0)[0].name).toBe('C4');
    expect(arp.getNextNote(1)[0].name).toBe('E4');
    expect(arp.getNextNote(2)[0].name).toBe('G4');
    expect(arp.getNextNote(3)[0].name).toBe('C4'); // wraps
  });

  it('cycles down through chord notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('down');

    expect(arp.getNextNote(0)[0].name).toBe('G4');
    expect(arp.getNextNote(1)[0].name).toBe('E4');
    expect(arp.getNextNote(2)[0].name).toBe('C4');
  });

  it('up/down bounces', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('upDown');

    const sequence = Array.from({ length: 6 }, (_, i) => arp.getNextNote(i)[0].name);
    expect(sequence).toEqual(['C4', 'E4', 'G4', 'G4', 'E4', 'C4']);
  });

  it('down/up bounces the other direction', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('downUp');

    const sequence = Array.from({ length: 6 }, (_, i) => arp.getNextNote(i)[0].name);
    expect(sequence).toEqual(['G4', 'E4', 'C4', 'C4', 'E4', 'G4']);
  });

  it('random returns valid notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('random');

    const note = arp.getNextNote(0);
    expect(mockChord.notes.some((n) => n.midi === note[0].midi)).toBe(true);
  });

  it('fingerpick plays root, 3rd, 5th, 3rd repeating', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('fingerpick');

    const sequence = Array.from({ length: 8 }, (_, i) => arp.getNextNote(i)[0].name);
    expect(sequence).toEqual(['C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4']);
  });

  it('returns empty array when no chord is set', () => {
    const arp = new Arpeggiator();
    expect(arp.getNextNote(0)).toEqual([]);
  });

  it('reset clears the current chord', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.reset();
    expect(arp.getNextNote(0)).toEqual([]);
  });

  it('setChordMode is settable without throwing', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    expect(() => arp.setChordMode('chordPlusArp')).not.toThrow();
  });

  it('setRate is settable without throwing', () => {
    const arp = new Arpeggiator();
    expect(() => arp.setRate('1/16')).not.toThrow();
  });
});
