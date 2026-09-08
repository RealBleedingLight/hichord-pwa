// src/components/DrumView.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import type { DrumSound } from '@/audio/types';
import { GENRES, getPatternsForGenre, type DrumPattern } from '@/data/drum-patterns';

const ACCENT = '#4a9eff';

const DRUM_PADS: { sound: DrumSound; label: string }[] = [
  { sound: 'kick', label: 'KICK' },
  { sound: 'altKick', label: 'ALT KICK' },
  { sound: 'snare', label: 'SNARE' },
  { sound: 'closedHH', label: 'CL HH' },
  { sound: 'openHH', label: 'OP HH' },
  { sound: 'tom', label: 'TOM' },
  { sound: 'bellRide', label: 'RIDE' },
];

export interface DrumViewProps {
  onTriggerDrum: (sound: DrumSound) => void;
  onHoldChange?: (sound: DrumSound, held: boolean) => void;
  onPatternChange?: (pattern: DrumPattern | null) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export function DrumView({ onTriggerDrum, onHoldChange, onPatternChange, isPlaying, onTogglePlay }: DrumViewProps) {
  const mode = useAppStore((s) => s.playMode);
  const [heldSounds, setHeldSounds] = useState<Set<DrumSound>>(new Set());
  const [genre, setGenre] = useState<string>(GENRES[0] ?? 'Rock');
  const [variationIndex, setVariationIndex] = useState(0);

  const patterns = getPatternsForGenre(genre);
  const currentPattern = patterns[variationIndex] ?? patterns[0] ?? null;

  useEffect(() => {
    onPatternChange?.(currentPattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPattern?.name]);

  const handlePadDown = (sound: DrumSound) => {
    onTriggerDrum(sound);
    setHeldSounds((prev) => new Set(prev).add(sound));
    onHoldChange?.(sound, true);
  };

  const handlePadUp = (sound: DrumSound) => {
    setHeldSounds((prev) => {
      const next = new Set(prev);
      next.delete(sound);
      return next;
    });
    onHoldChange?.(sound, false);
  };

  const handleGenreSelect = (g: string) => {
    setGenre(g);
    setVariationIndex(0);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, overflow: 'auto' }}>
      {mode === 'autoDrum' && (
        <div style={{ fontSize: 11, color: '#667', textAlign: 'center' }}>Hold pads to trigger at clock rate</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {DRUM_PADS.map((pad) => (
          <button
            key={pad.sound}
            data-testid={`drum-pad-${pad.sound}`}
            onPointerDown={() => handlePadDown(pad.sound)}
            onPointerUp={() => handlePadUp(pad.sound)}
            onPointerLeave={() => handlePadUp(pad.sound)}
            style={{
              minWidth: 60,
              minHeight: 44,
              borderRadius: 8,
              border: 'none',
              background: heldSounds.has(pad.sound) ? ACCENT : '#0f1626',
              color: heldSounds.has(pad.sound) ? '#111' : '#cdd',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {pad.label}
          </button>
        ))}
      </div>

      {mode === 'drumLoops' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {GENRES.map((g) => (
              <button
                key={g}
                data-testid={`genre-tab-${g}`}
                onClick={() => handleGenreSelect(g)}
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: genre === g ? ACCENT : '#0f1626',
                  color: genre === g ? '#111' : '#cdd',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {patterns.map((p, i) => (
              <button
                key={p.name}
                data-testid={`variation-${p.variation}`}
                onClick={() => setVariationIndex(i)}
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: i === variationIndex ? ACCENT : '#0f1626',
                  color: i === variationIndex ? '#111' : '#cdd',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {p.variation}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#cdd' }} data-testid="current-pattern-name">
              {currentPattern?.name ?? ''}
            </span>
            <button
              data-testid="drum-pattern-transport"
              onClick={() => onTogglePlay?.()}
              style={{
                minWidth: 44,
                minHeight: 32,
                borderRadius: 6,
                border: 'none',
                background: isPlaying ? '#e04040' : ACCENT,
                color: '#111',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '⏹' : '▶'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
