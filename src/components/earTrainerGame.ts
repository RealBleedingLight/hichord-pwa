// src/components/earTrainerGame.ts
// Pure game logic for the "Ear Trainer" chord-quality identification game.
import type { Key, ScaleName, ScaleDegree, ChordQuality, ChordVoicing, Note } from '@/music/types';
import { SCALE_DEGREES } from '@/music/types';
import { getDiatonicChord } from '@/music/chord-engine';
import { midiToFrequency, midiToNoteName } from '@/music/scales';

export type EarTrainerLevel = 1 | 2 | 3 | 4;
export type EarTrainerState = 'idle' | 'playing';
export type EarTrainerFeedback = 'none' | 'correct' | 'incorrect';

const LEVEL_1_QUALITIES: ChordQuality[] = ['major', 'minor', 'diminished'];
const LEVEL_2_QUALITIES: ChordQuality[] = ['maj7', 'min7', 'dom7', 'dim7'];
const LEVEL_3_QUALITIES: ChordQuality[] = ['add9', 'sus2', 'sus4', 'sixth'];
const LEVEL_4_QUALITIES: ChordQuality[] = [
  ...LEVEL_1_QUALITIES,
  ...LEVEL_2_QUALITIES,
  ...LEVEL_3_QUALITIES,
];

const OCTAVE = 4;

export function optionsForLevel(level: EarTrainerLevel): ChordQuality[] {
  switch (level) {
    case 1: return LEVEL_1_QUALITIES;
    case 2: return LEVEL_2_QUALITIES;
    case 3: return LEVEL_3_QUALITIES;
    case 4: return LEVEL_4_QUALITIES;
    default: return LEVEL_1_QUALITIES;
  }
}

const QUALITY_LABELS: Partial<Record<ChordQuality, string>> = {
  major: 'Major',
  minor: 'Minor',
  diminished: 'Diminished',
  maj7: 'Maj 7',
  min7: 'Min 7',
  dom7: 'Dominant 7',
  dim7: 'Dim 7',
  add9: 'Add 9',
  sus2: 'Sus 2',
  sus4: 'Sus 4',
  sixth: '6th',
};

export function qualityLabel(quality: ChordQuality): string {
  return QUALITY_LABELS[quality] ?? quality;
}

function qualitySuffix(quality: ChordQuality): string {
  switch (quality) {
    case 'major': return '';
    case 'minor': return 'm';
    case 'diminished': return 'dim';
    case 'maj7': return 'maj7';
    case 'min7': return 'm7';
    case 'dom7': return '7';
    case 'dim7': return 'dim7';
    case 'add9': return 'add9';
    case 'sus2': return 'sus2';
    case 'sus4': return 'sus4';
    case 'sixth': return '6';
    default: return quality;
  }
}

function intervalsFor(quality: ChordQuality): number[] {
  switch (quality) {
    case 'major': return [0, 4, 7];
    case 'minor': return [0, 3, 7];
    case 'diminished': return [0, 3, 6];
    case 'maj7': return [0, 4, 7, 11];
    case 'min7': return [0, 3, 7, 10];
    case 'dom7': return [0, 4, 7, 10];
    case 'dim7': return [0, 3, 6, 9];
    case 'add9': return [0, 4, 7, 14];
    case 'sus2': return [0, 2, 7];
    case 'sus4': return [0, 5, 7];
    case 'sixth': return [0, 4, 7, 9];
    default: return [0, 4, 7];
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

/**
 * Builds a chord voicing rooted at the diatonic root of `degree`, but with an
 * arbitrary quality substituted in (used so levels 2-4 can quiz 7th chords
 * and extensions that don't occur naturally as scale triads).
 */
export function buildChord(
  key: Key,
  scale: ScaleName,
  degree: ScaleDegree,
  quality: ChordQuality,
): ChordVoicing {
  const diatonic = getDiatonicChord(key, scale, degree, OCTAVE);
  const rootMidi = diatonic.notes[0]!.midi;
  const notes = intervalsFor(quality).map((interval) => makeNote(rootMidi + interval));
  return {
    notes,
    bass: null,
    quality,
    rootName: diatonic.rootName,
    displayName: `${diatonic.rootName}${qualitySuffix(quality)}`,
    inversion: 0,
  };
}

export interface EarTrainerRound {
  chord: ChordVoicing;
  answer: ChordQuality;
  options: ChordQuality[];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function generateRound(
  key: Key,
  scale: ScaleName,
  level: EarTrainerLevel,
  rng: () => number = Math.random,
): EarTrainerRound {
  const qualities = optionsForLevel(level);
  const answer = qualities[Math.floor(rng() * qualities.length)]!;
  const degree = SCALE_DEGREES[Math.floor(rng() * SCALE_DEGREES.length)]!;
  const chord = buildChord(key, scale, degree, answer);
  const options = shuffle(qualities, rng);
  return { chord, answer, options };
}

export interface EarTrainerSnapshot {
  state: EarTrainerState;
  level: EarTrainerLevel;
  round: EarTrainerRound | null;
  score: number;
  total: number;
  feedback: EarTrainerFeedback;
}

export class EarTrainerGame {
  private key: Key;
  private scale: ScaleName;
  private rng: () => number;

  private level: EarTrainerLevel = 1;
  private state: EarTrainerState = 'idle';
  private round: EarTrainerRound | null = null;
  private score = 0;
  private total = 0;
  private feedback: EarTrainerFeedback = 'none';

  constructor(key: Key, scale: ScaleName, rng: () => number = Math.random) {
    this.key = key;
    this.scale = scale;
    this.rng = rng;
  }

  setKeyScale(key: Key, scale: ScaleName): void {
    this.key = key;
    this.scale = scale;
  }

  setLevel(level: EarTrainerLevel): void {
    this.level = level;
  }

  start(): void {
    this.state = 'playing';
    this.score = 0;
    this.total = 0;
    this.nextRound();
  }

  reset(): void {
    this.state = 'idle';
    this.round = null;
    this.feedback = 'none';
  }

  nextRound(): void {
    this.round = generateRound(this.key, this.scale, this.level, this.rng);
    this.feedback = 'none';
  }

  /** Returns whether the guess was correct. */
  answer(quality: ChordQuality): boolean {
    if (!this.round || this.feedback !== 'none') return false;
    const correct = quality === this.round.answer;
    this.total++;
    if (correct) {
      this.score++;
      this.feedback = 'correct';
    } else {
      this.feedback = 'incorrect';
    }
    return correct;
  }

  getSnapshot(): EarTrainerSnapshot {
    return {
      state: this.state,
      level: this.level,
      round: this.round,
      score: this.score,
      total: this.total,
      feedback: this.feedback,
    };
  }
}
