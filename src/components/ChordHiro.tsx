// src/components/ChordHiro.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import type { ScaleDegree, ChordVoicing } from '@/music/types';
import { SCALE_DEGREES } from '@/music/types';
import { ChordHiroGame, type ChordHiroSnapshot } from './chordHiroGame';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;
const BG = CYBER.panel;

export interface ChordHiroProps {
  onChordTrigger?: (voicing: ChordVoicing) => void;
}

export function ChordHiro({ onChordTrigger }: ChordHiroProps) {
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);

  const gameRef = useRef<ChordHiroGame | null>(null);
  if (!gameRef.current) {
    gameRef.current = new ChordHiroGame(key, scale);
  }
  const game = gameRef.current;

  const [snapshot, setSnapshot] = useState<ChordHiroSnapshot>(() => game.getSnapshot());
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    game.setKeyScale(key, scale);
  }, [game, key, scale]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const loop = useCallback((time: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = time;
    const deltaMs = time - lastTimeRef.current;
    lastTimeRef.current = time;
    game.tick(deltaMs);
    setSnapshot(game.getSnapshot());
    if (game.getSnapshot().state === 'playing') {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [game]);

  const handleStart = useCallback(() => {
    game.start();
    lastTimeRef.current = null;
    setSnapshot(game.getSnapshot());
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [game, loop]);

  const handlePress = useCallback((degree: ScaleDegree) => {
    const result = game.pressDegree(degree);
    if (result.hit && result.chord && onChordTrigger) {
      onChordTrigger(result.chord.voicing);
    }
    setSnapshot(game.getSnapshot());
  }, [game, onChordTrigger]);

  const laneHeight = 260;

  const chords = useMemo(() => snapshot.chords, [snapshot.chords]);

  return (
    <div
      data-testid="chord-hiro"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        color: '#e8e8f0',
      }}
    >
      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
        <span data-testid="chord-hiro-score">Score: {snapshot.score}</span>
        <span data-testid="chord-hiro-streak">Streak: {snapshot.streak}</span>
        <span data-testid="chord-hiro-misses">Misses: {snapshot.misses}/5</span>
        <span data-testid="chord-hiro-high-score">Best: {snapshot.highScore}</span>
      </div>

      {snapshot.state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
          <div style={{ fontSize: 14, color: '#889' }}>Press the matching key before the chord falls!</div>
          <button
            data-testid="chord-hiro-start"
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

      {snapshot.state === 'gameover' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
          <div data-testid="chord-hiro-gameover" style={{ fontSize: 18, fontWeight: 700 }}>Game Over</div>
          <div style={{ fontSize: 13, color: '#889' }}>Final score: {snapshot.score}</div>
          <button
            data-testid="chord-hiro-start"
            onClick={handleStart}
            style={{
              minWidth: 160, minHeight: 44, borderRadius: 8, border: 'none',
              background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            RESTART
          </button>
        </div>
      )}

      {snapshot.state === 'playing' && (
        <>
          <div
            data-testid="chord-hiro-lane"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              height: laneHeight,
              background: BG,
              borderRadius: 8,
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {chords.map((c) => (
              <div
                key={c.id}
                data-testid={`chord-hiro-falling-${c.id}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${Math.min(1, c.position) * (laneHeight - 28)}px`,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#243b6b',
                  margin: '0 8px',
                  borderRadius: 6,
                  padding: '4px 0',
                }}
              >
                {c.displayName}
              </div>
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: ACCENT }} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {SCALE_DEGREES.map((degree) => (
              <button
                key={degree}
                data-testid={`chord-hiro-key-${degree}`}
                onClick={() => handlePress(degree)}
                style={{
                  minWidth: 36, minHeight: 36, borderRadius: 6, border: 'none',
                  background: '#2d3a5f', color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', touchAction: 'manipulation',
                }}
              >
                {degree}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
