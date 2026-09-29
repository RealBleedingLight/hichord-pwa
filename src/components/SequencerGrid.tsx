// src/components/SequencerGrid.tsx
import { useMemo } from 'react';
import { useAppStore, SEQUENCE_SLOTS, STEPS_PER_SLOT } from '@/store';
import { getChord } from '@/music/chord-engine';
import { CYBER } from '@/theme';

export interface SequencerGridProps {
  onToggleTransport?: () => void;
}

const SLOT_COLORS = [CYBER.secondary, CYBER.primary, CYBER.amber, '#4caf50'];

/**
 * Chord progression editor: 4 bars split into 8 half-bar slots.
 *
 * Workflow: tap a slot (it glows), then press a chord key — the chord (with
 * whatever the pad is doing) is written there and the next slot is selected,
 * so a whole progression is just "tap slot 1, play 4–8 chords". Empty slots
 * hold the previous chord. The progression plays with ▶ alongside the beat.
 */
export function SequencerGrid({ onToggleTransport }: SequencerGridProps) {
  const sequence = useAppStore((s) => s.sequence);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const setSelectedSlot = useAppStore((s) => s.setSelectedSlot);
  const setSequenceSlot = useAppStore((s) => s.setSequenceSlot);
  const clearSequence = useAppStore((s) => s.clearSequence);
  const transportPlaying = useAppStore((s) => s.transportPlaying);
  const transportStep = useAppStore((s) => s.transportStep);
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  const joystickMode = useAppStore((s) => s.joystickMode);
  const chordLocks = useAppStore((s) => s.chordLocks);

  const names = useMemo(() => sequence.map((slot) => slot
    ? getChord(key, scale, slot.degree, 4, slot.direction, joystickMode, 0, 'off', chordLocks).displayName
    : null), [sequence, key, scale, joystickMode, chordLocks]);

  const playingSlot = transportPlaying && transportStep !== null ? Math.floor(transportStep / STEPS_PER_SLOT) % SEQUENCE_SLOTS : null;
  const hasAny = sequence.some(Boolean);

  // An empty slot "holds" the last filled slot before it (wrapping round).
  const heldFrom = (i: number): number | null => {
    for (let k = 0; k < SEQUENCE_SLOTS; k++) {
      const j = (i - k + SEQUENCE_SLOTS) % SEQUENCE_SLOTS;
      if (sequence[j]) return j;
    }
    return null;
  };

  const btn = (active: boolean, color: string): React.CSSProperties => ({
    height: 34, padding: '0 12px', borderRadius: 6,
    background: active ? color : '#1a0808',
    color: active ? '#000' : CYBER.textMid,
    border: '1px solid ' + (active ? color : CYBER.border),
    fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', touchAction: 'manipulation',
  });

  return (
    <div data-testid="sequencer" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 8, padding: 8, overflow: 'hidden',
      background: CYBER.panel, border: '1px solid ' + CYBER.border, borderRadius: 8,
      fontFamily: CYBER.fontMono,
    }}>
      <div style={{ fontSize: 12, color: CYBER.textDim, minHeight: 16 }}>
        {selectedSlot !== null
          ? <>Press a <b style={{ color: CYBER.secondary }}>chord key</b> to fill slot {selectedSlot + 1} · slide the pad while holding to colour it</>
          : hasAny ? 'Tap a slot to change it. Empty slots hold the previous chord.' : 'Tap slot 1, then play chord keys to write a progression.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: 10, color: CYBER.textDim, textAlign: 'center' }}>
        {[1, 2, 3, 4].map((bar) => <div key={bar} style={{ borderBottom: '1px solid ' + CYBER.border }}>BAR {bar}</div>)}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${SEQUENCE_SLOTS}, 1fr)`, gap: 4 }}>
        {sequence.map((slot, i) => {
          const color = SLOT_COLORS[Math.floor(i / 2) % SLOT_COLORS.length]!;
          const selected = selectedSlot === i;
          const playing = playingSlot === i;
          const source = slot ? i : heldFrom(i);
          return (
            <button
              key={i}
              data-testid={`sequencer-step-${i}`}
              onClick={() => setSelectedSlot(selected ? null : i)}
              style={{
                position: 'relative',
                minWidth: 0,
                borderRadius: 6,
                border: selected ? `2px solid ${CYBER.secondary}` : `1px solid ${slot ? color : CYBER.border}`,
                background: slot ? `${color}22` : '#120404',
                boxShadow: playing ? `0 0 14px ${color}` : selected ? '0 0 10px ' + CYBER.secondaryGlow : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                cursor: 'pointer', touchAction: 'manipulation', padding: 2,
              }}
            >
              <span style={{
                fontFamily: CYBER.fontDisplay, fontWeight: 700,
                fontSize: 'clamp(11px, 1.8vw, 16px)',
                color: slot ? color : source !== null ? '#6a4a4a' : '#5a3a3a',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>
                {slot ? names[i] : source !== null ? '···' : '—'}
              </span>
              {slot && (
                <span
                  role="button"
                  aria-label={`Clear slot ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setSequenceSlot(i, null); }}
                  style={{ fontSize: 11, color: CYBER.textDim, padding: '0 6px' }}
                >✕</span>
              )}
              {playing && <span style={{ position: 'absolute', bottom: 2, left: 4, right: 4, height: 3, borderRadius: 2, background: color }} />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button data-testid="sequencer-play" onClick={onToggleTransport} style={btn(transportPlaying, CYBER.secondary)}>
          {transportPlaying ? '■ STOP' : '▶ PLAY'}
        </button>
        <button onClick={() => setSelectedSlot(0)} style={btn(false, CYBER.secondary)}>WRITE FROM 1</button>
        <span style={{ flex: 1 }} />
        <button data-testid="sequencer-clear" onClick={clearSequence} style={btn(false, CYBER.primary)} disabled={!hasAny}>CLEAR</button>
      </div>
    </div>
  );
}
