import type {
  Key,
  ScaleName,
  ScaleDegree,
  ChordQuality,
  ChordVoicing,
  Inversion,
  Note,
  JoystickDirection,
  JoystickMode,
  BassMode,
  ChordLock,
} from './types';
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

function getChordIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case 'major': return [0, 4, 7];
    case 'minor': return [0, 3, 7];
    case 'diminished': return [0, 3, 6];
    case 'augmented': return [0, 4, 8];
    case 'dom7': return [0, 4, 7, 10];
    case 'maj7': return [0, 4, 7, 11];
    case 'min7': return [0, 3, 7, 10];
    case 'dim7': return [0, 3, 6, 9];
    case 'halfDim7': return [0, 3, 6, 10];
    case 'sus2': return [0, 2, 7];
    case 'sus4': return [0, 5, 7];
    case 'sixth': return [0, 4, 7, 9];
    case 'ninth': return [0, 4, 7, 10, 14];
    case 'dom9': return [0, 4, 7, 10, 14];
    case 'add9': return [0, 4, 7, 14];
    case 'add11': return [0, 4, 7, 17];
    case 'min11': return [0, 3, 7, 10, 14, 17];
    case 'dom7sharp9': return [0, 4, 7, 10, 15];
    case 'sus4plus7': return [0, 5, 7, 10];
    case 'minMaj7': return [0, 3, 7, 11];
    case 'maj13': return [0, 4, 7, 11, 14, 21];
    case 'sixNine': return [0, 4, 7, 9, 14];
    case 'maj7sharp11': return [0, 4, 7, 11, 18];
    case 'dom13': return [0, 4, 7, 10, 14, 21];
    case 'dom7flat9': return [0, 4, 7, 10, 13];
    case 'dom7alt': return [0, 4, 6, 10, 13];
    default: return [0, 4, 7];
  }
}

const DEFAULT_MODE_MAP: Partial<Record<JoystickDirection, ChordQuality>> = {
  up: 'minor', // flip: if already minor, flip to major (handled specially below)
  upRight: 'dom7',
  right: 'maj7',
  downRight: 'ninth',
  down: 'sus4',
  downLeft: 'sixth',
  left: 'diminished',
  upLeft: 'augmented',
};

const EXTENDED_MODE_MAP: Partial<Record<JoystickDirection, ChordQuality>> = {
  up: 'minor',
  upRight: 'dom9',
  right: 'add11',
  downRight: 'min11',
  down: 'dom7sharp9',
  downLeft: 'add9',
  left: 'sus4plus7',
  upLeft: 'halfDim7',
};

const CHROMATIC_MODE_MAP: Partial<Record<JoystickDirection, ChordQuality>> = {
  up: 'minMaj7',
  upRight: 'dom13',
  right: 'sixNine',
  downRight: 'dom7alt',
  down: 'maj13',
  downLeft: 'dom7flat9',
  left: 'halfDim7',
  upLeft: 'maj7sharp11',
};

function getModeMap(mode: JoystickMode): Partial<Record<JoystickDirection, ChordQuality>> {
  switch (mode) {
    case 'extended': return EXTENDED_MODE_MAP;
    case 'chromatic': return CHROMATIC_MODE_MAP;
    default: return DEFAULT_MODE_MAP;
  }
}

export function modifyChord(
  voicing: ChordVoicing,
  direction: JoystickDirection,
  mode: JoystickMode,
): ChordVoicing {
  if (direction === 'center') return voicing;

  const modeMap = getModeMap(mode);
  let newQuality = modeMap[direction];
  if (!newQuality) return voicing;

  // "up" in default mode flips major<->minor instead of forcing minor
  if (direction === 'up' && mode === 'default') {
    newQuality = voicing.quality === 'minor' ? 'major' : 'minor';
  }

  const rootNote = voicing.notes.find(
    (n) => n.name.replace(/\d+$/, '') === voicing.rootName,
  );
  const rootMidi = rootNote ? rootNote.midi : voicing.notes[0]!.midi;

  const intervals = getChordIntervals(newQuality);
  const newNotes = intervals.map((interval) => makeNote(rootMidi + interval));

  return {
    notes: newNotes,
    bass: voicing.bass,
    quality: newQuality,
    rootName: voicing.rootName,
    displayName: `${voicing.rootName}${qualitySuffix(newQuality)}`,
    inversion: 0,
  };
}

export function getChord(
  key: Key,
  scale: ScaleName,
  degree: ScaleDegree,
  octave: number,
  direction: JoystickDirection,
  mode: JoystickMode,
  inversion: Inversion,
  bassMode: BassMode,
  chordLocks: ChordLock[],
): ChordVoicing {
  // Chord lock overrides the live joystick direction for its own degree.
  const lock = chordLocks.find((l) => l.degree === degree);
  const effectiveDirection = lock ? lock.direction : direction;

  let chord = getDiatonicChord(key, scale, degree, octave, inversion);
  chord = modifyChord(chord, effectiveDirection, mode);

  // modifyChord always resets to root position; re-apply the requested inversion.
  if (inversion > 0 && chord.inversion !== inversion) {
    const invertedMidi = applyInversion(
      chord.notes.map((n) => n.midi),
      inversion,
    );
    chord = {
      ...chord,
      notes: invertedMidi.map(makeNote),
      inversion,
    };
  }

  // Add bass note.
  if (bassMode !== 'off') {
    const rootNote = chord.notes.find(
      (n) => n.name.replace(/\d+$/, '') === chord.rootName,
    );
    const rootMidi = rootNote ? rootNote.midi : chord.notes[0]!.midi;
    chord = { ...chord, bass: makeNote(rootMidi - 12) };
  }

  return chord;
}
