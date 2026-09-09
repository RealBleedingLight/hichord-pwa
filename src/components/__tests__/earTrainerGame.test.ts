// src/components/__tests__/earTrainerGame.test.ts
import { describe, it, expect } from 'vitest';
import {
  EarTrainerGame,
  optionsForLevel,
  generateRound,
  buildChord,
  qualityLabel,
} from '@/components/earTrainerGame';

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('optionsForLevel', () => {
  it('level 1 is triad qualities', () => {
    expect(optionsForLevel(1)).toEqual(['major', 'minor', 'diminished']);
  });

  it('level 2 is 7th chords', () => {
    expect(optionsForLevel(2)).toEqual(['maj7', 'min7', 'dom7', 'dim7']);
  });

  it('level 3 is extensions', () => {
    expect(optionsForLevel(3)).toEqual(['add9', 'sus2', 'sus4', 'sixth']);
  });

  it('level 4 mixes all qualities', () => {
    const all = optionsForLevel(4);
    expect(all).toEqual(expect.arrayContaining(optionsForLevel(1)));
    expect(all).toEqual(expect.arrayContaining(optionsForLevel(2)));
    expect(all).toEqual(expect.arrayContaining(optionsForLevel(3)));
    expect(all.length).toBe(11);
  });
});

describe('buildChord', () => {
  it('builds a chord with the requested quality rooted at the diatonic degree', () => {
    const chord = buildChord('C', 'major', 1, 'min7');
    expect(chord.quality).toBe('min7');
    expect(chord.rootName).toBe('C');
    expect(chord.notes).toHaveLength(4); // root, m3, 5, m7
    expect(chord.displayName).toBe('Cm7');
  });

  it('builds a plain major triad for level-1 qualities', () => {
    const chord = buildChord('G', 'major', 1, 'major');
    expect(chord.notes).toHaveLength(3);
    expect(chord.displayName).toBe('G');
  });
});

describe('qualityLabel', () => {
  it('returns a human-readable label', () => {
    expect(qualityLabel('min7')).toBe('Min 7');
    expect(qualityLabel('major')).toBe('Major');
  });
});

describe('generateRound', () => {
  it('produces a round whose answer is one of the level options', () => {
    const rng = seq([0.5, 0.2]);
    const round = generateRound('C', 'major', 2, rng);
    expect(optionsForLevel(2)).toContain(round.answer);
    expect(round.chord.quality).toBe(round.answer);
    expect(round.options).toEqual(expect.arrayContaining(optionsForLevel(2)));
  });
});

describe('EarTrainerGame', () => {
  it('starts idle', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1]));
    expect(game.getSnapshot().state).toBe('idle');
    expect(game.getSnapshot().round).toBeNull();
  });

  it('start() enters playing state with a round ready', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1]));
    game.setLevel(1);
    game.start();
    const snap = game.getSnapshot();
    expect(snap.state).toBe('playing');
    expect(snap.round).not.toBeNull();
    expect(snap.score).toBe(0);
    expect(snap.total).toBe(0);
  });

  it('answering correctly increases score and sets correct feedback', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1]));
    game.setLevel(1);
    game.start();
    const answer = game.getSnapshot().round!.answer;
    const wasCorrect = game.answer(answer);
    expect(wasCorrect).toBe(true);
    const snap = game.getSnapshot();
    expect(snap.score).toBe(1);
    expect(snap.total).toBe(1);
    expect(snap.feedback).toBe('correct');
  });

  it('answering incorrectly does not increase score and sets incorrect feedback', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1]));
    game.setLevel(1);
    game.start();
    const answer = game.getSnapshot().round!.answer;
    const wrongOption = optionsForLevel(1).find((q) => q !== answer)!;
    const wasCorrect = game.answer(wrongOption);
    expect(wasCorrect).toBe(false);
    const snap = game.getSnapshot();
    expect(snap.score).toBe(0);
    expect(snap.total).toBe(1);
    expect(snap.feedback).toBe('incorrect');
  });

  it('does not double-count a second answer for the same round', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1]));
    game.start();
    const answer = game.getSnapshot().round!.answer;
    game.answer(answer);
    game.answer(answer);
    expect(game.getSnapshot().total).toBe(1);
  });

  it('nextRound() clears feedback and produces a fresh round', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.1, 0.4, 0.6]));
    game.start();
    const answer = game.getSnapshot().round!.answer;
    game.answer(answer);
    game.nextRound();
    expect(game.getSnapshot().feedback).toBe('none');
    expect(game.getSnapshot().round).not.toBeNull();
  });

  it('setLevel changes the pool of qualities used for future rounds', () => {
    const game = new EarTrainerGame('C', 'major', seq([0.9]));
    game.setLevel(2);
    game.start();
    expect(optionsForLevel(2)).toContain(game.getSnapshot().round!.answer);
  });
});
