import type { Key, ScaleName } from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:     [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:     [0, 2, 3, 5, 7, 9, 11],
  majorPentatonic:  [0, 2, 4, 7, 9],
  minorPentatonic:  [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
};

export function getScaleIntervals(scale: ScaleName): number[] {
  return SCALE_INTERVALS[scale];
}

export function keyToMidi(key: Key, octave: number): number {
  const index = NOTE_NAMES.indexOf(key);
  return (octave + 1) * 12 + index;
}

export function getScaleNotes(key: Key, scale: ScaleName, octave: number): number[] {
  const root = keyToMidi(key, octave);
  return SCALE_INTERVALS[scale].map((interval) => root + interval);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const [, noteName, octaveStr] = match;
  const noteIndex = NOTE_NAMES.indexOf(noteName as typeof NOTE_NAMES[number]);
  if (noteIndex === -1) throw new Error(`Invalid note: ${noteName}`);
  return (parseInt(octaveStr!) + 1) * 12 + noteIndex;
}
