// src/components/DrumView.tsx
import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store';
import type { DrumKitName, DrumSound } from '@/audio/types';
import { GENRES, getPatternsForGenre } from '@/data/drum-patterns';
import { CYBER } from '@/theme';

/* ── 4×4 Pad Layout ─────────────────────────────── */
const DRUM_PADS: { sound: DrumSound; label: string }[] = [
  { sound: 'kick', label: 'KICK' },
  { sound: 'snare', label: 'SNARE' },
  { sound: 'clap', label: 'CLAP' },
  { sound: 'rim', label: 'RIM' },
  { sound: 'closedHH', label: 'HAT' },
  { sound: 'openHH', label: 'OPEN HAT' },
  { sound: 'tomHigh', label: 'TOM HI' },
  { sound: 'tomLow', label: 'TOM LO' },
  { sound: 'perc', label: 'COWBELL' },
  { sound: 'crash', label: 'CRASH' },
  { sound: 'ride', label: 'RIDE' },
  { sound: 'shaker', label: 'SHAKER' },
  { sound: 'altKick', label: 'KICK 2' },
  { sound: 'fx1', label: 'ZAP' },
  { sound: 'fx2', label: 'SUB' },
  { sound: 'fx3', label: 'SWELL' },
];

/* ── Beat editor rows ─────────────────────────────── */
const SEQ_ROWS: { sound: DrumSound; label: string; color: string }[] = [
  { sound: 'kick', label: 'KICK', color: CYBER.primary },
  { sound: 'snare', label: 'SNR', color: CYBER.amber },
  { sound: 'clap', label: 'CLAP', color: CYBER.amber },
  { sound: 'closedHH', label: 'HAT', color: CYBER.secondary },
  { sound: 'openHH', label: 'OHAT', color: CYBER.secondary },
  { sound: 'bellRide', label: 'RIDE', color: '#b388ff' },
  { sound: 'tom', label: 'TOM', color: '#4caf50' },
];

const DRUM_KITS: { value: DrumKitName; label: string }[] = [
  { value: 'tight', label: 'TIGHT' },
  { value: 'x0x', label: '808' },
  { value: 'x9x', label: '909' },
  { value: 'lynn', label: 'LYNN' },
  { value: 'kr78', label: 'KR78' },
  { value: 'trap', label: 'TRAP' },
];

const NUM_STEPS = 16;

export interface DrumViewProps {
  onTriggerDrum: (sound: DrumSound) => void;
  onHoldChange?: (sound: DrumSound, held: boolean) => void;
  onToggleTransport?: () => void;
}

export function DrumView({ onTriggerDrum, onHoldChange, onToggleTransport }: DrumViewProps) {
  const mode = useAppStore((s) => s.playMode);
  const beatGenre = useAppStore((s) => s.beatGenre);
  const beatVariation = useAppStore((s) => s.beatVariation);
  const beatHits = useAppStore((s) => s.beatHits);
  const beatEdited = useAppStore((s) => s.beatEdited);
  const selectBeat = useAppStore((s) => s.selectBeat);
  const toggleBeatHit = useAppStore((s) => s.toggleBeatHit);
  const clearBeat = useAppStore((s) => s.clearBeat);
  const transportPlaying = useAppStore((s) => s.transportPlaying);
  const transportStep = useAppStore((s) => s.transportStep);
  const drumKit = useAppStore((s) => s.drumKit);
  const setDrumKit = useAppStore((s) => s.setDrumKit);
  const [heldSounds, setHeldSounds] = useState<Set<DrumSound>>(new Set());

  const genrePatterns = getPatternsForGenre(beatGenre);
  const currentStep = transportPlaying && transportStep !== null ? transportStep % NUM_STEPS : null;

  const hitSet = useMemo(() => new Set(beatHits.map((h) => `${h.sound}:${h.step}`)), [beatHits]);
  // Show any extra sounds the chosen pattern uses beyond the default rows.
  const rows = useMemo(() => {
    const extra = [...new Set(beatHits.map((h) => h.sound))]
      .filter((s) => !SEQ_ROWS.some((r) => r.sound === s))
      .map((s) => ({ sound: s, label: s.slice(0, 4).toUpperCase(), color: '#888' }));
    return [...SEQ_ROWS, ...extra];
  }, [beatHits]);

  const handlePadDown = useCallback((sound: DrumSound) => {
    onTriggerDrum(sound);
    setHeldSounds((prev) => new Set(prev).add(sound));
    onHoldChange?.(sound, true);
  }, [onTriggerDrum, onHoldChange]);

  const handlePadUp = useCallback((sound: DrumSound) => {
    setHeldSounds((prev) => {
      if (!prev.has(sound)) return prev;
      const next = new Set(prev);
      next.delete(sound);
      return next;
    });
    onHoldChange?.(sound, false);
  }, [onHoldChange]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 8px', borderRadius: 4,
    border: active ? 'none' : '1px solid ' + CYBER.border,
    background: active ? CYBER.primary : '#1a0808',
    color: active ? '#fff' : CYBER.textDim,
    fontSize: 10, fontWeight: 700, fontFamily: CYBER.fontMono,
    cursor: 'pointer', letterSpacing: 1, touchAction: 'manipulation',
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: 'minmax(220px, 34%) 1fr',
      gap: 10, padding: 6, overflow: 'hidden',
    }}>
      {/* ── Left: 4×4 Pad Grid ──────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <div style={{ fontSize: 11, color: CYBER.textDim, textAlign: 'center', fontFamily: CYBER.fontMono }}>
          {mode === 'autoDrum' ? 'HOLD A PAD — IT REPEATS AT THE ARP RATE' : 'TAP PADS TO PLAY'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr', gap: 5, flex: 1, minHeight: 0 }}>
          {DRUM_PADS.map((pad) => {
            const isHeld = heldSounds.has(pad.sound);
            return (
              <button
                key={pad.sound}
                data-testid={`drum-pad-${pad.sound}`}
                onPointerDown={(e) => { e.preventDefault(); handlePadDown(pad.sound); }}
                onPointerUp={() => handlePadUp(pad.sound)}
                onPointerLeave={() => handlePadUp(pad.sound)}
                onPointerCancel={() => handlePadUp(pad.sound)}
                style={{
                  borderRadius: 8,
                  border: isHeld ? 'none' : '1px solid ' + CYBER.borderBright,
                  background: isHeld ? CYBER.primary : '#1a0808',
                  boxShadow: isHeld ? '0 0 16px ' + CYBER.primaryGlow : 'none',
                  cursor: 'pointer',
                  touchAction: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 2, minHeight: 0,
                  fontSize: 10, fontWeight: 700, fontFamily: CYBER.fontMono,
                  color: isHeld ? '#fff' : CYBER.textMid, letterSpacing: 0.5,
                }}
              >
                {pad.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
          {DRUM_KITS.map((k) => (
            <button key={k.value} onClick={() => setDrumKit(k.value)} style={chip(drumKit === k.value)}>{k.label}</button>
          ))}
        </div>
      </div>

      {/* ── Right: the beat (plays with ▶ on the bottom bar) ─ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GENRES.map((g) => (
            <button key={g} data-testid={`genre-tab-${g}`} onClick={() => selectBeat(g, 0)} style={chip(beatGenre === g)}>
              {g.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {genrePatterns.map((p, i) => (
            <button
              key={p.name}
              data-testid={`variation-${p.variation}`}
              onClick={() => selectBeat(beatGenre, i)}
              style={chip(i === beatVariation && !beatEdited)}
            >
              {p.variation.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          {rows.map((row) => (
            <div key={row.sound} style={{ display: 'flex', alignItems: 'stretch', gap: 2, flex: 1, minHeight: 18, maxHeight: 34 }}>
              <button
                onPointerDown={(e) => { e.preventDefault(); onTriggerDrum(row.sound); }}
                style={{
                  width: 40, fontSize: 10, color: row.color, background: 'transparent', border: 'none',
                  fontFamily: CYBER.fontMono, textAlign: 'right', paddingRight: 4, flexShrink: 0, cursor: 'pointer',
                }}
              >
                {row.label}
              </button>
              {Array.from({ length: NUM_STEPS }, (_, stepIdx) => {
                const active = hitSet.has(`${row.sound}:${stepIdx}`);
                const isNow = currentStep === stepIdx;
                return (
                  <button
                    key={stepIdx}
                    data-testid={`beat-cell-${row.sound}-${stepIdx}`}
                    aria-pressed={active}
                    onClick={() => toggleBeatHit(stepIdx, row.sound)}
                    style={{
                      flex: 1, minWidth: 0,
                      borderRadius: 3,
                      border: isNow ? '1px solid #fff' : active ? 'none' : '1px solid ' + (stepIdx % 4 === 0 ? '#552222' : '#331111'),
                      background: active ? row.color : stepIdx % 4 === 0 ? '#1f0a0a' : '#140606',
                      boxShadow: active && isNow ? `0 0 10px ${row.color}` : 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            data-testid="drum-pattern-transport"
            onClick={() => onToggleTransport?.()}
            style={{
              height: 32, padding: '0 14px', borderRadius: 6, border: 'none',
              background: transportPlaying ? CYBER.secondary : '#1a0808',
              color: transportPlaying ? '#000' : CYBER.secondary,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {transportPlaying ? '■ STOP' : '▶ PLAY'}
          </button>
          <span style={{ fontSize: 12, color: CYBER.textMid, fontFamily: CYBER.fontMono }} data-testid="current-pattern-name">
            {beatGenre} - {genrePatterns[beatVariation]?.variation ?? ''}{beatEdited ? ' (edited)' : ''}
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={clearBeat} style={chip(false)}>CLEAR</button>
        </div>
      </div>
    </div>
  );
}
