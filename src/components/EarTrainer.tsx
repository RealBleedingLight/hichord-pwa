// src/components/EarTrainer.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import type { ChordQuality, ChordVoicing } from '@/music/types';
import {
  EarTrainerGame,
  type EarTrainerLevel,
  type EarTrainerSnapshot,
  qualityLabel,
} from './earTrainerGame';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;
const GREEN = '#3ecf6e';
const RED = '#e04040';

export interface EarTrainerProps {
  onChordTrigger?: (voicing: ChordVoicing) => void;
}

const LEVELS: EarTrainerLevel[] = [1, 2, 3, 4];

const LEVEL_LABELS: Record<EarTrainerLevel, string> = {
  1: 'Triads',
  2: '7th Chords',
  3: 'Extensions',
  4: 'All Qualities',
};

export function EarTrainer({ onChordTrigger }: EarTrainerProps) {
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);

  const gameRef = useRef<EarTrainerGame | null>(null);
  if (!gameRef.current) {
    gameRef.current = new EarTrainerGame(key, scale);
  }
  const game = gameRef.current;

  useEffect(() => {
    game.setKeyScale(key, scale);
  }, [game, key, scale]);

  const [snapshot, setSnapshot] = useState<EarTrainerSnapshot>(() => game.getSnapshot());
  const [level, setLevelState] = useState<EarTrainerLevel>(1);

  const playCurrentChord = useCallback(() => {
    const round = game.getSnapshot().round;
    if (round && onChordTrigger) {
      onChordTrigger(round.chord);
    }
  }, [game, onChordTrigger]);

  const handleSelectLevel = useCallback((lvl: EarTrainerLevel) => {
    setLevelState(lvl);
    game.setLevel(lvl);
  }, [game]);

  const handleStart = useCallback(() => {
    game.setLevel(level);
    game.start();
    const snap = game.getSnapshot();
    setSnapshot(snap);
    if (snap.round && onChordTrigger) {
      onChordTrigger(snap.round.chord);
    }
  }, [game, level, onChordTrigger]);

  const handleAnswer = useCallback((quality: ChordQuality) => {
    game.answer(quality);
    setSnapshot(game.getSnapshot());
  }, [game]);

  const handleNext = useCallback(() => {
    game.nextRound();
    const snap = game.getSnapshot();
    setSnapshot(snap);
    if (snap.round && onChordTrigger) {
      onChordTrigger(snap.round.chord);
    }
  }, [game, onChordTrigger]);

  const feedbackColor = snapshot.feedback === 'correct' ? GREEN : snapshot.feedback === 'incorrect' ? RED : '#889';

  return (
    <div
      data-testid="ear-trainer"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
        color: '#e8e8f0',
      }}
    >
      <div style={{ fontSize: 13 }} data-testid="ear-trainer-score">
        Score: {snapshot.score} / {snapshot.total}
      </div>

      {snapshot.state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#889' }}>Choose a difficulty level</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                data-testid={`ear-trainer-level-${lvl}`}
                onClick={() => handleSelectLevel(lvl)}
                style={{
                  minWidth: 44, minHeight: 44, borderRadius: 8,
                  border: level === lvl ? `2px solid ${ACCENT}` : '2px solid transparent',
                  background: '#2d3a5f', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', touchAction: 'manipulation', padding: 4,
                }}
              >
                {LEVEL_LABELS[lvl]}
              </button>
            ))}
          </div>
          <button
            data-testid="ear-trainer-start"
            onClick={handleStart}
            style={{
              minWidth: 160, minHeight: 44, borderRadius: 8, border: 'none',
              background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            START
          </button>
        </div>
      )}

      {snapshot.state === 'playing' && snapshot.round && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 12, color: '#889' }}>Level: {LEVEL_LABELS[snapshot.level]}</div>

          <button
            data-testid="ear-trainer-play"
            onClick={playCurrentChord}
            style={{
              minWidth: 140, minHeight: 44, borderRadius: 8, border: 'none',
              background: '#2d3a5f', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            ▶ Play Chord
          </button>

          <div
            data-testid="ear-trainer-feedback"
            style={{ fontSize: 13, fontWeight: 700, color: feedbackColor, minHeight: 18 }}
          >
            {snapshot.feedback === 'correct' && 'Correct!'}
            {snapshot.feedback === 'incorrect' && `Incorrect — it was ${qualityLabel(snapshot.round.answer)}`}
            {snapshot.feedback === 'none' && ' '}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {snapshot.round.options.map((quality) => (
              <button
                key={quality}
                data-testid={`ear-trainer-option-${quality}`}
                onClick={() => handleAnswer(quality)}
                disabled={snapshot.feedback !== 'none'}
                style={{
                  minWidth: 80, minHeight: 40, borderRadius: 8, border: 'none',
                  background: snapshot.feedback !== 'none' && quality === snapshot.round!.answer ? GREEN : '#2d3a5f',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: snapshot.feedback === 'none' ? 'pointer' : 'default',
                  touchAction: 'manipulation',
                  opacity: snapshot.feedback !== 'none' && quality !== snapshot.round!.answer ? 0.5 : 1,
                }}
              >
                {qualityLabel(quality)}
              </button>
            ))}
          </div>

          {snapshot.feedback !== 'none' && (
            <button
              data-testid="ear-trainer-next"
              onClick={handleNext}
              style={{
                minWidth: 120, minHeight: 40, borderRadius: 8, border: 'none',
                background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
}
