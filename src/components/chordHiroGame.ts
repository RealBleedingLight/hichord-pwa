// src/components/chordHiroGame.ts
// Pure game logic for the "Chord Hiro" falling-chord rhythm game.
// Kept free of React so it can be unit tested directly and driven by
// a requestAnimationFrame loop from the ChordHiro component.
import type { Key, ScaleName, ScaleDegree } from '@/music/types';
import { getDiatonicChord } from '@/music/chord-engine';
import type { ChordVoicing } from '@/music/types';

export type ChordHiroState = 'idle' | 'playing' | 'gameover';

export interface FallingChord {
  id: number;
  degree: ScaleDegree;
  displayName: string;
  voicing: ChordVoicing;
  /** 0 = just spawned (top), 1 = at the hit line, >1 = past the hit line. */
  position: number;
}

export interface ChordHiroSnapshot {
  state: ChordHiroState;
  chords: FallingChord[];
  score: number;
  misses: number;
  streak: number;
  highScore: number;
}

const MAX_MISSES = 5;
const BASE_SPEED = 0.15; // position units per second
const MAX_SPEED_MULTIPLIER = 3;
const BASE_SPAWN_INTERVAL_MS = 3000;
const MIN_SPAWN_INTERVAL_MS = 900;
const HIT_WINDOW = 0.12;
const OCTAVE = 4;

/** Falling speed (position units/sec) at a given score. Exported for testing/tuning. */
export function speedForScore(score: number): number {
  const multiplier = Math.min(MAX_SPEED_MULTIPLIER, 1 + score * 0.05);
  return BASE_SPEED * multiplier;
}

/** Spawn interval (ms) at a given score. Exported for testing/tuning. */
export function spawnIntervalForScore(score: number): number {
  return Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - score * 100);
}

export class ChordHiroGame {
  private key: Key;
  private scale: ScaleName;
  private rng: () => number;

  private state: ChordHiroState = 'idle';
  private chords: FallingChord[] = [];
  private score = 0;
  private misses = 0;
  private streak = 0;
  private highScore = 0;
  private nextId = 0;
  private msSinceSpawn = 0;

  constructor(key: Key, scale: ScaleName, rng: () => number = Math.random) {
    this.key = key;
    this.scale = scale;
    this.rng = rng;
  }

  setKeyScale(key: Key, scale: ScaleName): void {
    this.key = key;
    this.scale = scale;
  }

  start(): void {
    this.state = 'playing';
    this.chords = [];
    this.score = 0;
    this.misses = 0;
    this.streak = 0;
    this.nextId = 0;
    this.msSinceSpawn = 0;
  }

  reset(): void {
    this.state = 'idle';
    this.chords = [];
  }

  private speed(): number {
    return speedForScore(this.score);
  }

  private spawnInterval(): number {
    return spawnIntervalForScore(this.score);
  }

  private spawnChord(): void {
    const degree = (Math.floor(this.rng() * 7) + 1) as ScaleDegree;
    const voicing = getDiatonicChord(this.key, this.scale, degree, OCTAVE);
    this.chords.push({
      id: this.nextId++,
      degree,
      displayName: voicing.displayName,
      voicing,
      position: 0,
    });
  }

  private bumpHighScore(): void {
    if (this.score > this.highScore) this.highScore = this.score;
  }

  /** Advance the simulation by `deltaMs` milliseconds. */
  tick(deltaMs: number): void {
    if (this.state !== 'playing') return;

    this.msSinceSpawn += deltaMs;
    if (this.msSinceSpawn >= this.spawnInterval()) {
      this.msSinceSpawn = 0;
      this.spawnChord();
    }

    const speed = this.speed();
    const deltaSec = deltaMs / 1000;
    for (const chord of this.chords) {
      chord.position += speed * deltaSec;
    }

    const stillFalling: FallingChord[] = [];
    for (const chord of this.chords) {
      if (chord.position > 1 + HIT_WINDOW) {
        this.misses++;
        this.streak = 0;
      } else {
        stillFalling.push(chord);
      }
    }
    this.chords = stillFalling;

    if (this.misses >= MAX_MISSES) {
      this.bumpHighScore();
      this.state = 'gameover';
    }
  }

  /** Player pressed the button for `degree`. Returns whether it hit a chord. */
  pressDegree(degree: ScaleDegree): { hit: boolean; chord?: FallingChord } {
    if (this.state !== 'playing') return { hit: false };

    const candidates = this.chords.filter(
      (c) => c.degree === degree && c.position >= 1 - HIT_WINDOW && c.position <= 1 + HIT_WINDOW,
    );
    if (candidates.length === 0) return { hit: false };

    candidates.sort((a, b) => Math.abs(a.position - 1) - Math.abs(b.position - 1));
    const hitChord = candidates[0]!;
    this.chords = this.chords.filter((c) => c.id !== hitChord.id);
    this.score++;
    this.streak++;
    this.bumpHighScore();
    return { hit: true, chord: hitChord };
  }

  getSnapshot(): ChordHiroSnapshot {
    return {
      state: this.state,
      chords: this.chords.map((c) => ({ ...c })),
      score: this.score,
      misses: this.misses,
      streak: this.streak,
      highScore: this.highScore,
    };
  }
}
