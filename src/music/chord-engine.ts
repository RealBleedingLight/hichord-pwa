import type { Key, ScaleName, ScaleDegree, ChordQuality, ChordVoicing, Inversion, Note } from './types';
import { getScaleNotes, midiToFrequency, midiToNoteName } from './scales';

const MAJOR_SCALE_QUALITIES: ChordQuality[] = [
  'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
];

const MINOR_SCALE_QUALITIES: ChordQuality[] = [
  'minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major',
];

function getQualitiesForScale(scale: ScaleName): ChordQuality[] {
  switch (scale) {
    case 'naturalMinor':
    case 'minorPentatonic':
      return MINOR_SCALE_QUALITIES;
    case 'harmonicMinor':
      return ['minor', 'diminished', 'augmented', 'minor', 'major', 'major', 'diminished'];
    case 'melodicMinor':
      return ['minor', 'minor', 'augmented', 'major', 'major', 'diminished', 'diminished'];
    case 'dorian':
      return ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'];
    case 'mixolydian':
      return ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major'];
    case 'lydian':
      return ['major', 'major', 'minor', 'diminished', 'major', 'minor', 'minor'];
    case 'blues':
    case 'majorPentatonic':
    default:
      return MAJOR_SCALE_QUALITIES;
  }
}

function qualitySuffix(quality: ChordQuality): string {
  switch (quality) {
    case 'major': return '';
    case 'minor': return 'm';
    case 'diminished': return 'dim';
    case 'augmented': return 'aug';
    case 'dom7': return '7';
    case 'maj7': return 'maj7';
    case 'min7': return 'm7';
    case 'dim7': return 'dim7';
    case 'halfDim7': return 'ø7';
    case 'sus2': return 'sus2';
    case 'sus4': return 'sus4';
    case 'sixth': return '6';
    case 'ninth': return '9';
    default: return quality;
  }
}

function makeNote(midi: number): Note {
  return {
    midi,
    frequency: midiToFrequency(midi),
    name: midiToNoteName(midi),
    octave: Math.floor(midi / 12) - 1,
  };
}

function getTriadIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case 'major': return [0, 4, 7];
    case 'minor': return [0, 3, 7];
    case 'diminished': return [0, 3, 6];
    case 'augmented': return [0, 4, 8];
    default: return [0, 4, 7];
  }
}

function applyInversion(midiNotes: number[], inversion: Inversion): number[] {
  const notes = [...midiNotes];
  for (let i = 0; i < inversion; i++) {
    const lowest = notes.shift()!;
    notes.push(lowest + 12);
  }
  return notes;
}

export function getDiatonicChord(
  key: Key,
  scale: ScaleName,
  degree: ScaleDegree,
  octave: number,
  inversion: Inversion = 0,
): ChordVoicing {
  const scaleNotes = getScaleNotes(key, scale, octave);
  const degreeIndex = degree - 1;
  const rootMidi = scaleNotes[degreeIndex]!;
  const quality = getQualitiesForScale(scale)[degreeIndex]!;
  const intervals = getTriadIntervals(quality);
  const chordMidi = intervals.map((interval) => rootMidi + interval);
  const invertedMidi = applyInversion(chordMidi, inversion);
  const notes = invertedMidi.map(makeNote);
  const rootNote = makeNote(rootMidi);
  const rootName = rootNote.name.replace(/\d+$/, '');

  return {
    notes,
    bass: null,
    quality,
    rootName,
    displayName: `${rootName}${qualitySuffix(quality)}`,
    inversion,
  };
}
