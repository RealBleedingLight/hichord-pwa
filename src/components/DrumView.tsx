// src/components/DrumView.tsx
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import type { DrumSound } from '@/audio/types';
import { GENRES, getPatternsForGenre, type DrumPattern } from '@/data/drum-patterns';
import { CYBER } from '@/theme';

/* ── 4×4 Pad Layout ─────────────────────────────── */
const DRUM_PADS: { sound: DrumSound; label: string; note: string }[] = [
  { sound: 'kick',    label: 'KICK',    note: 'C1' },
  { sound: 'snare',   label: 'SNARE',   note: 'D1' },
  { sound: 'clap',    label: 'CLAP',    note: 'E1' },
  { sound: 'rim',     label: 'RIM',     note: 'F1' },
  { sound: 'closedHH', label: 'CH',     note: 'F#1' },
  { sound: 'openHH',  label: 'OH',      note: 'G#1' },
  { sound: 'tomHigh', label: 'TOM H',   note: 'A1' },
  { sound: 'tomLow',  label: 'TOM L',   note: 'B1' },
  { sound: 'perc',    label: 'PERC',    note: 'C2' },
  { sound: 'crash',   label: 'CRASH',   note: 'C#2' },
  { sound: 'ride',    label: 'RIDE',    note: 'D#2' },
  { sound: 'shaker',  label: 'SHAKER',  note: 'E2' },
  { sound: 'fx1',     label: 'FX 1',    note: 'F2' },
  { sound: 'fx2',     label: 'FX 2',    note: 'G2' },
  { sound: 'fx3',     label: 'FX 3',    note: 'A2' },
  { sound: 'fx4',     label: 'FX 4',    note: 'B2' },
];

/* ── Step Sequencer Rows ────────────────────────── */
const SEQ_ROWS: { sound: DrumSound; label: string; color: string }[] = [
  { sound: 'kick',     label: 'KCK', color: CYBER.primary },
  { sound: 'snare',    label: 'SNR', color: CYBER.amber },
  { sound: 'closedHH', label: 'CHH', color: CYBER.secondary },
  { sound: 'openHH',   label: 'OHH', color: CYBER.secondary },
  { sound: 'clap',     label: 'CLP', color: CYBER.amber },
];

const NUM_STEPS = 16;
const NUM_PATTERNS = 4;

type StepGrid = boolean[][];

function emptyGrid(): StepGrid {
  return SEQ_ROWS.map(() => new Array(NUM_STEPS).fill(false) as boolean[]);
}

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
  const [activePattern, setActivePattern] = useState(0);
  const [patterns, setPatterns] = useState<StepGrid[]>(() =>
    Array.from({ length: NUM_PATTERNS }, () => emptyGrid()),
  );
  const [currentStep] = useState(0); // playhead position — visual only for now

  const genrePatterns = getPatternsForGenre(genre);
  const currentGenrePattern = genrePatterns[variationIndex] ?? genrePatterns[0] ?? null;

  useEffect(() => {
    onPatternChange?.(currentGenrePattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGenrePattern?.name]);

  const handlePadDown = useCallback((sound: DrumSound) => {
    onTriggerDrum(sound);
    setHeldSounds((prev) => new Set(prev).add(sound));
    onHoldChange?.(sound, true);
  }, [onTriggerDrum, onHoldChange]);

  const handlePadUp = useCallback((sound: DrumSound) => {
    setHeldSounds((prev) => {
      const next = new Set(prev);
      next.delete(sound);
      return next;
    });
    onHoldChange?.(sound, false);
  }, [onHoldChange]);

  const handleGenreSelect = (g: string) => {
    setGenre(g);
    setVariationIndex(0);
  };

  const toggleStep = (rowIdx: number, stepIdx: number) => {
    setPatterns((prev) => {
      const next = prev.map((p) => p.map((r) => [...r]));
      const grid = next[activePattern];
      if (grid) {
        const row = grid[rowIdx];
        if (row) {
          row[stepIdx] = !row[stepIdx];
        }
      }
      return next;
    });
  };

  const grid = patterns[activePattern] ?? emptyGrid();

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '340px 1fr',
      gap: 8, padding: 8, overflow: 'hidden',
    }}>
      {/* ── Left: 4×4 Pad Grid ──────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mode === 'autoDrum' && (
          <div style={{ fontSize: 9, color: CYBER.textDim, textAlign: 'center', fontFamily: CYBER.fontMono }}>
            HOLD PADS TO TRIGGER AT CLOCK RATE
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          flex: 1,
        }}>
          {DRUM_PADS.map((pad) => {
            const isHeld = heldSounds.has(pad.sound);
            return (
              <button
                key={pad.sound}
                data-testid={`drum-pad-${pad.sound}`}
                onPointerDown={() => handlePadDown(pad.sound)}
                onPointerUp={() => handlePadUp(pad.sound)}
                onPointerLeave={() => handlePadUp(pad.sound)}
                style={{
                  borderRadius: 8,
                  border: isHeld ? 'none' : '1px solid #440000',
                  background: isHeld ? CYBER.primary : '#1a0808',
                  boxShadow: isHeld ? '0 0 16px ' + CYBER.primaryGlow : 'none',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 2, padding: 4,
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  fontFamily: CYBER.fontMono,
                  color: isHeld ? '#fff' : '#884444',
                  letterSpacing: 1,
                }}>{pad.label}</span>
                <span style={{
                  fontSize: 7, color: isHeld ? 'rgba(255,255,255,.6)' : '#553333',
                  fontFamily: CYBER.fontMono,
                }}>{pad.note}</span>
              </button>
            );
          })}
        </div>

        {/* Genre / Variation selectors for drumLoops */}
        {mode === 'drumLoops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
              {GENRES.map((g) => (
                <button
                  key={g}
                  data-testid={`genre-tab-${g}`}
                  onClick={() => handleGenreSelect(g)}
                  style={{
                    padding: '3px 6px', borderRadius: 4,
                    border: genre === g ? 'none' : '1px solid ' + CYBER.border,
                    background: genre === g ? CYBER.primary : '#1a0808',
                    color: genre === g ? '#fff' : CYBER.textDim,
                    fontSize: 8, fontWeight: 700, fontFamily: CYBER.fontMono,
                    cursor: 'pointer', letterSpacing: 1,
                  }}
                >
                  {g.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
              {genrePatterns.map((p, i) => (
                <button
                  key={p.name}
                  data-testid={`variation-${p.variation}`}
                  onClick={() => setVariationIndex(i)}
                  style={{
                    padding: '3px 6px', borderRadius: 4,
                    border: i === variationIndex ? 'none' : '1px solid ' + CYBER.border,
                    background: i === variationIndex ? CYBER.primary : '#1a0808',
                    color: i === variationIndex ? '#fff' : CYBER.textDim,
                    fontSize: 8, fontWeight: 700, fontFamily: CYBER.fontMono,
                    cursor: 'pointer',
                  }}
                >
                  {p.variation.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: CYBER.textMid, fontFamily: CYBER.fontMono }} data-testid="current-pattern-name">
                {currentGenrePattern?.name ?? ''}
              </span>
              <button
                data-testid="drum-pattern-transport"
                onClick={() => onTogglePlay?.()}
                style={{
                  minWidth: 36, minHeight: 24, borderRadius: 4,
                  border: 'none',
                  background: isPlaying ? CYBER.primary : '#1a0808',
                  color: isPlaying ? '#fff' : CYBER.textMid,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: isPlaying ? '0 0 8px ' + CYBER.primaryGlow : 'none',
                }}
              >
                {isPlaying ? '⏹' : '▶'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Step Sequencer Grid ──────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        overflow: 'hidden',
      }}>
        {/* Pattern banks */}
        <div style={{ display: 'flex', gap: 4, padding: '0 4px' }}>
          {Array.from({ length: NUM_PATTERNS }, (_, i) => (
            <button
              key={i}
              onClick={() => setActivePattern(i)}
              style={{
                padding: '3px 10px', borderRadius: 4,
                border: activePattern === i ? 'none' : '1px solid #330000',
                background: activePattern === i ? CYBER.primary : '#1a0808',
                color: activePattern === i ? '#fff' : CYBER.textDim,
                fontSize: 9, fontWeight: 700, fontFamily: CYBER.fontMono,
                cursor: 'pointer', letterSpacing: 1,
                boxShadow: activePattern === i ? '0 0 8px ' + CYBER.primaryGlow : 'none',
              }}
            >
              P{i + 1}
            </button>
          ))}
        </div>

        {/* Sequencer grid */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
          overflow: 'auto',
        }}>
          {SEQ_ROWS.map((row, rowIdx) => (
            <div key={row.sound} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{
                width: 28, fontSize: 7, color: '#884444',
                fontFamily: CYBER.fontMono, textAlign: 'right',
                paddingRight: 4, flexShrink: 0, letterSpacing: 0.5,
              }}>
                {row.label}
              </span>
              {Array.from({ length: NUM_STEPS }, (_, stepIdx) => {
                const active = grid[rowIdx]?.[stepIdx] ?? false;
                return (
                  <button
                    key={stepIdx}
                    onClick={() => toggleStep(rowIdx, stepIdx)}
                    style={{
                      flex: 1, minHeight: 22,
                      borderRadius: 3,
                      border: active ? 'none' : '1px solid #330000',
                      background: active ? row.color : '#1a0808',
                      boxShadow: active ? `0 0 8px ${row.color}44` : 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      opacity: active ? 1 : 0.7,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Playhead row */}
        <div style={{ display: 'flex', gap: 2, padding: '0 0 0 32px' }}>
          {Array.from({ length: NUM_STEPS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i === currentStep ? CYBER.primary : '#220000',
              boxShadow: i === currentStep ? '0 0 6px ' + CYBER.primaryGlow : 'none',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
