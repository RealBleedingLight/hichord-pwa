// src/components/__tests__/chordHiroGame.test.ts
import { describe, it, expect } from 'vitest';
import { ChordHiroGame, speedForScore, spawnIntervalForScore } from '@/components/chordHiroGame';

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('ChordHiroGame', () => {
  it('starts idle and enters playing state on start()', () => {
    const game = new ChordHiroGame('C', 'major');
    expect(game.getSnapshot().state).toBe('idle');
    game.start();
    expect(game.getSnapshot().state).toBe('playing');
    expect(game.getSnapshot().score).toBe(0);
    expect(game.getSnapshot().misses).toBe(0);
  });

  it('does nothing when ticked before start', () => {
    const game = new ChordHiroGame('C', 'major');
    game.tick(5000);
    expect(game.getSnapshot().chords).toHaveLength(0);
  });

  it('spawns a chord after the spawn interval elapses', () => {
    const rng = seq([0.1]); // degree 1
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000);
    const snap = game.getSnapshot();
    expect(snap.chords).toHaveLength(1);
    expect(snap.chords[0]!.degree).toBe(1);
    expect(snap.chords[0]!.displayName).toBeTruthy();
  });

  it('moves falling chords down over time', () => {
    const rng = seq([0.1]);
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000); // spawn
    const posAfterSpawn = game.getSnapshot().chords[0]!.position;
    game.tick(1000);
    const posLater = game.getSnapshot().chords[0]!.position;
    expect(posLater).toBeGreaterThan(posAfterSpawn);
  });

  it('registers a hit when the correct degree is pressed near the hit line', () => {
    const rng = seq([0.1]); // degree 1 = floor(0.1*7)+1 = 1
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000); // spawn chord for degree 1
    // Advance until chord reaches hit line (position ~1). speed = 0.15 units/sec at score 0.
    game.tick(1000 / 0.15); // ~1 unit of position
    const result = game.pressDegree(1);
    expect(result.hit).toBe(true);
    expect(game.getSnapshot().score).toBe(1);
    expect(game.getSnapshot().streak).toBe(1);
    expect(game.getSnapshot().chords).toHaveLength(0);
  });

  it('does not register a hit for the wrong degree', () => {
    const rng = seq([0.1]); // degree 1
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000);
    game.tick(1000 / 0.15);
    const result = game.pressDegree(2);
    expect(result.hit).toBe(false);
    expect(game.getSnapshot().score).toBe(0);
  });

  it('counts a miss and resets streak when a chord passes the hit line unpressed', () => {
    const rng = seq([0.1]);
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000); // spawn
    game.tick(5000); // let it fall well past the hit line
    expect(game.getSnapshot().misses).toBe(1);
    expect(game.getSnapshot().streak).toBe(0);
  });

  it('ends the game after 5 misses and records a high score', () => {
    const rng = seq([0.1]);
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    for (let i = 0; i < 5; i++) {
      game.tick(3000); // spawn
      game.tick(20000); // miss
    }
    const snap = game.getSnapshot();
    expect(snap.state).toBe('gameover');
    expect(snap.misses).toBeGreaterThanOrEqual(5);
  });

  it('speedForScore increases monotonically with score, capped at a max multiplier', () => {
    expect(speedForScore(10)).toBeGreaterThan(speedForScore(0));
    expect(speedForScore(100)).toBe(speedForScore(1000)); // capped
  });

  it('spawnIntervalForScore decreases with score, floored at a minimum', () => {
    expect(spawnIntervalForScore(10)).toBeLessThan(spawnIntervalForScore(0));
    expect(spawnIntervalForScore(1000)).toBe(spawnIntervalForScore(500)); // floored
  });

  it('persists high score across a reset', () => {
    const rng = seq([0.1]);
    const game = new ChordHiroGame('C', 'major', rng);
    game.start();
    game.tick(3000);
    game.tick(1000 / 0.15);
    game.pressDegree(1);
    expect(game.getSnapshot().highScore).toBe(1);
    game.reset();
    expect(game.getSnapshot().state).toBe('idle');
    expect(game.getSnapshot().highScore).toBe(1);
  });
});
