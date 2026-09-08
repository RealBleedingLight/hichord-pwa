import type { DrumSound } from '@/audio/types';

export interface DrumHit {
  step: number; // 0-15 (16th note grid)
  sound: DrumSound;
  velocity: number; // 0-1
}

export interface DrumPattern {
  name: string;
  genre: string;
  variation: string;
  hits: DrumHit[];
}

function pattern(genre: string, variation: string, hits: DrumHit[]): DrumPattern {
  return { name: `${genre} - ${variation}`, genre, variation, hits };
}

function h(step: number, sound: DrumSound, velocity = 1): DrumHit {
  return { step, sound, velocity };
}

/**
 * Describes a genre's idiomatic groove: the kick/snare skeleton plus which
 * cymbal sound carries the timekeeping ("closedHH" for most genres, the
 * ride/"bellRide" for the swung jazz feel).
 */
interface GenreGroove {
  kick: number[];
  snare: number[];
  hhSteps: number[];
  timeKeeper: DrumSound;
  fillSteps: number[]; // steps used for the tom fill run in the "Fills" variation
}

function fourOnFloorHH(): number[] {
  return [0, 2, 4, 6, 8, 10, 12, 14];
}

/** Builds the standard 8 variations for a genre from its base groove. */
function genrePatterns(genre: string, groove: GenreGroove): DrumPattern[] {
  const { kick, snare, hhSteps, timeKeeper, fillSteps } = groove;

  const original = pattern(genre, 'Original', [
    ...kick.map((s) => h(s, 'kick')),
    ...snare.map((s) => h(s, 'snare')),
    ...hhSteps.map((s) => h(s, timeKeeper)),
  ]);

  const ghost = pattern(genre, 'Ghost', [
    ...kick.map((s) => h(s, 'kick')),
    ...snare.map((s) => h(s, 'snare')),
    ...hhSteps
      .filter((s) => !snare.includes(s))
      .map((s) => h(s, 'snare', 0.3)),
    ...hhSteps.map((s) => h(s, timeKeeper)),
  ]);

  const busyHH = pattern(genre, 'Busy HH', [
    ...kick.map((s) => h(s, 'kick')),
    ...snare.map((s) => h(s, 'snare')),
    ...Array.from({ length: 16 }, (_, i) => h(i, timeKeeper, i % 2 === 0 ? 1 : 0.6)),
  ]);

  const syncopated = pattern(genre, 'Syncopated', [
    ...kick.map((s) => h(s, 'kick')),
    ...kick.map((s) => h((s + 3) % 16, 'kick', 0.7)),
    ...snare.map((s) => h(s, 'snare')),
    ...hhSteps.map((s) => h(s, timeKeeper)),
  ]);

  const fills = pattern(genre, 'Fills', [
    ...kick.map((s) => h(s, 'kick')),
    ...snare.map((s) => h(s, 'snare')),
    ...fillSteps.map((s) => h(s, 'tom')),
  ]);

  const halfTime = pattern(genre, 'Half-time', [
    h(kick[0] ?? 0, 'kick'),
    h(8, 'snare'),
    ...[0, 4, 8, 12].map((s) => h(s, timeKeeper)),
  ]);

  const doubleTime = pattern(genre, 'Double-time', [
    h(0, 'kick'), h(2, 'snare'), h(4, 'kick'), h(6, 'snare'),
    h(8, 'kick'), h(10, 'snare'), h(12, 'kick'), h(14, 'snare'),
    ...Array.from({ length: 16 }, (_, i) => h(i, timeKeeper, 0.7)),
  ]);

  const jazz = pattern(genre, 'Jazz', [
    h(kick[0] ?? 0, 'kick'),
    h(7, 'kick'),
    ...snare.map((s) => h(s, 'snare')),
    h(0, 'bellRide'), h(3, 'bellRide'), h(6, 'bellRide'), h(9, 'bellRide'), h(12, 'bellRide'),
  ]);

  return [original, ghost, busyHH, syncopated, fills, halfTime, doubleTime, jazz];
}

const GENRE_GROOVES: Record<string, GenreGroove> = {
  Rock: {
    kick: [0, 8],
    snare: [4, 12],
    hhSteps: fourOnFloorHH().concat([1, 3, 5, 7, 9, 11, 13, 15]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b),
    timeKeeper: 'closedHH',
    fillSteps: [8, 9, 10, 11],
  },
  Disco: {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hhSteps: [2, 6, 10, 14],
    timeKeeper: 'openHH',
    fillSteps: [12, 13, 14, 15],
  },
  Reggae: {
    kick: [0, 10],
    snare: [8],
    hhSteps: [2, 6, 10, 14],
    timeKeeper: 'closedHH',
    fillSteps: [6, 8, 10, 12],
  },
  Funk: {
    kick: [0, 3, 8, 11],
    snare: [4, 12],
    hhSteps: fourOnFloorHH(),
    timeKeeper: 'closedHH',
    fillSteps: [10, 11, 12, 13],
  },
  'Hip-Hop': {
    kick: [0, 10],
    snare: [4, 12],
    hhSteps: [0, 4, 8, 12],
    timeKeeper: 'closedHH',
    fillSteps: [12, 13, 14, 15],
  },
  Electro: {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hhSteps: Array.from({ length: 16 }, (_, i) => i),
    timeKeeper: 'closedHH',
    fillSteps: [8, 10, 12, 14],
  },
  Jazz: {
    kick: [0, 7],
    snare: [4, 12],
    hhSteps: [0, 3, 6, 9, 12],
    timeKeeper: 'bellRide',
    fillSteps: [8, 9, 10, 11],
  },
};

export const GENRES = ['Rock', 'Disco', 'Reggae', 'Funk', 'Hip-Hop', 'Electro', 'Jazz'];

export const DRUM_PATTERNS: DrumPattern[] = [
  // Rock (8 variations) — matches the hand-authored reference groove exactly.
  pattern('Rock', 'Original', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Ghost', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    h(2, 'snare', 0.3), h(6, 'snare', 0.3), h(10, 'snare', 0.3), h(14, 'snare', 0.3),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Busy HH', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    ...Array.from({ length: 16 }, (_, i) => h(i, 'closedHH', i % 2 === 0 ? 1 : 0.6)),
  ]),
  pattern('Rock', 'Syncopated', [
    h(0, 'kick'), h(3, 'kick'), h(4, 'snare'), h(8, 'kick'), h(11, 'kick'), h(12, 'snare'),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Fills', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'tom'), h(9, 'tom'), h(10, 'tom'),
    h(11, 'tom'), h(12, 'snare'), h(14, 'kick'),
  ]),
  pattern('Rock', 'Half-time', [
    h(0, 'kick'), h(8, 'snare'),
    h(0, 'closedHH'), h(4, 'closedHH'), h(8, 'closedHH'), h(12, 'closedHH'),
  ]),
  pattern('Rock', 'Double-time', [
    h(0, 'kick'), h(2, 'snare'), h(4, 'kick'), h(6, 'snare'),
    h(8, 'kick'), h(10, 'snare'), h(12, 'kick'), h(14, 'snare'),
    ...Array.from({ length: 16 }, (_, i) => h(i, 'closedHH', 0.7)),
  ]),
  pattern('Rock', 'Jazz', [
    h(0, 'kick'), h(7, 'kick'), h(4, 'snare'), h(12, 'snare'),
    h(0, 'bellRide'), h(3, 'bellRide'), h(6, 'bellRide'), h(9, 'bellRide'), h(12, 'bellRide'),
  ]),
  // Disco, Reggae, Funk, Hip-Hop, Electro, Jazz (8 variations each) — generated
  // from each genre's idiomatic groove skeleton via genrePatterns().
  ...genrePatterns('Disco', GENRE_GROOVES.Disco!),
  ...genrePatterns('Reggae', GENRE_GROOVES.Reggae!),
  ...genrePatterns('Funk', GENRE_GROOVES.Funk!),
  ...genrePatterns('Hip-Hop', GENRE_GROOVES['Hip-Hop']!),
  ...genrePatterns('Electro', GENRE_GROOVES.Electro!),
  ...genrePatterns('Jazz', GENRE_GROOVES.Jazz!),
];

export function getPatternsForGenre(genre: string): DrumPattern[] {
  return DRUM_PATTERNS.filter((p) => p.genre === genre);
}
