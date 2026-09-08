export type Key = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ScaleName =
  | 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor'
  | 'majorPentatonic' | 'minorPentatonic' | 'blues'
  | 'dorian' | 'mixolydian' | 'lydian';

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type JoystickDirection = 'up' | 'upRight' | 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft' | 'center';

export type JoystickMode = 'default' | 'extended' | 'chromatic';

export type ChordQuality =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dom7' | 'maj7' | 'min7' | 'dim7' | 'halfDim7'
  | 'sus2' | 'sus4' | 'sixth' | 'ninth'
  | 'dom9' | 'add9' | 'add11' | 'min11'
  | 'dom7sharp9' | 'sus4plus7'
  | 'minMaj7' | 'maj13' | 'sixNine' | 'maj7sharp11'
  | 'dom13' | 'dom7flat9' | 'dom7alt'
  | 'dom7b9' | 'halfDim7Chromatic';

export type Inversion = 0 | 1 | 2;

export type BassMode = 'off' | 'root' | 'slash';

export interface Note {
  midi: number;
  frequency: number;
  name: string;
  octave: number;
}

export interface ChordVoicing {
  notes: Note[];
  bass: Note | null;
  quality: ChordQuality;
  rootName: string;
  displayName: string;
  inversion: Inversion;
}

export interface ChordLock {
  degree: ScaleDegree;
  direction: JoystickDirection;
}

export const ALL_KEYS: Key[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALE_DEGREES: ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];
