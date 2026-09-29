// src/components/SequencerGrid.tsx
import { useMemo, useState } from 'react';
import { useAppStore, currentSection, SEQUENCE_SLOTS, STEPS_PER_SLOT, SECTION_NAMES } from '@/store';
import { getChord } from '@/music/chord-engine';
import { getPatternsForGenre } from '@/data/drum-patterns';
import { CYBER } from '@/theme';

export interface SequencerGridProps {
  onToggleTransport?: () => void;
}

const SLOT_COLORS = [CYBER.secondary, CYBER.primary, CYBER.amber, '#4caf50'];
const MAX_CHAIN = 16;

/**
 * Chord progression editor.
 *
 * Four sections (A–D, e.g. verse / chorus / bridge), each 4 bars split into
 * 8 half-bar slots. Tap a slot, then press chord keys to write them in; empty
 * slots hold the previous chord. SONG mode plays the sections in the order
 * of the arrangement row; otherwise the section being edited loops.
 */
export function SequencerGrid({ onToggleTransport }: SequencerGridProps) {
  const sections = useAppStore((s) => s.sections);
  const editSection = useAppStore((s) => s.editSection);
  const setEditSection = useAppStore((s) => s.setEditSection);
  const copySection = useAppStore((s) => s.copySection);
  const songChain = useAppStore((s) => s.songChain);
  const setSongChain = useAppStore((s) => s.setSongChain);
  const songMode = useAppStore((s) => s.songMode);
  const setSongMode = useAppStore((s) => s.setSongMode);
  const playingSection = useAppStore((s) => s.playingSection);
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
  const [copying, setCopying] = useState(false);
  const seqRecording = useAppStore((s) => s.seqRecording);
  const setSeqRecording = useAppStore((s) => s.setSeqRecording);
  const sectionBeats = useAppStore((s) => s.sectionBeats);
  const setSectionBeat = useAppStore((s) => s.setSectionBeat);
  const autoFills = useAppStore((s) => s.autoFills);
  const setAutoFills = useAppStore((s) => s.setAutoFills);
  const beatGenre = useAppStore((s) => s.beatGenre);
  const variations = getPatternsForGenre(beatGenre);
  const sectionBeat = sectionBeats[editSection] ?? null;
  // Tap cycles: MAIN → each variation of the current genre → MAIN.
  const cycleSectionBeat = () => {
    const next = sectionBeat === null ? 0 : sectionBeat + 1 < variations.length ? sectionBeat + 1 : null;
    setSectionBeat(editSection, next);
  };

  const sequence = currentSection({ sections, editSection });
  const names = useMemo(() => sequence.map((slot) => slot
    ? getChord(key, scale, slot.degree, 4, slot.direction, joystickMode, 0, 'off', chordLocks).displayName
    : null), [sequence, key, scale, joystickMode, chordLocks]);

  const showingPlayhead = transportPlaying && transportStep !== null && (!songMode || playingSection === editSection);
  const playingSlot = showingPlayhead ? Math.floor(transportStep! / STEPS_PER_SLOT) % SEQUENCE_SLOTS : null;
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
    height: 30, padding: '0 10px', borderRadius: 6,
    background: active ? color : '#1a0808',
    color: active ? '#000' : CYBER.textMid,
    border: '1px solid ' + (active ? color : CYBER.border),
    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', touchAction: 'manipulation',
    flexShrink: 0,
  });

  const sectionTab = (i: number): React.CSSProperties => {
    const filled = sections[i]?.some(Boolean);
    const editing = i === editSection;
    const live = transportPlaying && playingSection === i;
    return {
      width: 34, height: 30, borderRadius: 6, cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0, padding: 0,
      fontFamily: CYBER.fontDisplay, fontWeight: 800, fontSize: 13,
      background: editing ? CYBER.secondary : '#1a0808',
      color: editing ? '#000' : filled ? CYBER.textLight : '#6a4a4a',
      border: live ? '2px solid ' + CYBER.green : '1px solid ' + (editing ? CYBER.secondary : CYBER.border),
    };
  };

  return (
    <div data-testid="sequencer" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 6, padding: 8, overflow: 'hidden',
      background: CYBER.panel, border: '1px solid ' + CYBER.border, borderRadius: 8,
      fontFamily: CYBER.fontMono,
    }}>
      {/* Sections */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {SECTION_NAMES.map((name, i) => (
          <button
            key={name}
            data-testid={`section-${name}`}
            onClick={() => {
              if (copying) { copySection(editSection, i); setCopying(false); setEditSection(i); return; }
              setEditSection(i);
            }}
            style={sectionTab(i)}
          >
            {name}
          </button>
        ))}
        <button
          onClick={() => setCopying(!copying)}
          disabled={!hasAny}
          style={{ ...btn(copying, CYBER.amber), opacity: hasAny ? 1 : 0.5 }}
        >
          {copying ? `→ ?` : 'COPY'}
        </button>
        <button data-testid="section-beat" onClick={cycleSectionBeat} title="Beat used while this section plays"
          style={{ ...btn(sectionBeat !== null, CYBER.amber), flexShrink: 1, minWidth: 0, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          BEAT: {sectionBeat === null ? 'MAIN' : (variations[sectionBeat]?.variation ?? 'MAIN').toUpperCase()}
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: seqRecording ? CYBER.primary : CYBER.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {seqRecording
            ? (transportPlaying ? 'REC: play chords in time' : 'REC armed — press ▶')
            : selectedSlot !== null ? `Play a chord → slot ${selectedSlot + 1}` : hasAny ? 'Tap a slot to edit' : 'Tap slot 1, then play chords'}
        </span>
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
                fontSize: 'clamp(10px, 1.5vw, 15px)',
                color: slot ? color : '#6a4a4a',
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

      {/* Song arrangement */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <button data-testid="song-mode" onClick={() => { setSongMode(!songMode); if (!songMode) setSeqRecording(false); }} style={btn(songMode, CYBER.green)}>
          {songMode ? 'SONG ✓' : 'SONG'}
        </button>
        <button data-testid="auto-fills" onClick={() => setAutoFills(!autoFills)} style={btn(autoFills, CYBER.amber)}
          title="Drum fill in the bar before each section change, crash on the new section">
          FILLS
        </button>
        <div data-testid="song-chain" style={{ display: 'flex', gap: 3, overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {songChain.map((sec, i) => {
            const live = songMode && transportPlaying && playingSection === sec;
            return (
              <button
                key={i}
                aria-label={`Remove ${SECTION_NAMES[sec]} from song position ${i + 1}`}
                onClick={() => setSongChain(songChain.filter((_, j) => j !== i))}
                style={{
                  minWidth: 26, height: 26, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                  background: live ? CYBER.green : '#1f1f1f', color: live ? '#000' : CYBER.textLight,
                  border: '1px solid #333', fontWeight: 700, fontSize: 12,
                }}
              >
                {SECTION_NAMES[sec]}
              </button>
            );
          })}
        </div>
        {SECTION_NAMES.map((name, i) => (
          <button
            key={name}
            data-testid={`song-add-${name}`}
            onClick={() => setSongChain([...songChain, i].slice(0, MAX_CHAIN))}
            style={{ ...btn(false, CYBER.green), padding: '0 6px', height: 26 }}
          >
            +{name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button data-testid="sequencer-play" onClick={onToggleTransport} style={btn(transportPlaying, CYBER.secondary)}>
          {transportPlaying ? '■ STOP' : '▶ PLAY'}
        </button>
        <button
          data-testid="sequencer-rec"
          onClick={() => { setSeqRecording(!seqRecording); if (!seqRecording) setSongMode(false); }}
          title="Record chords in time over the beat — they snap to the nearest half bar"
          style={btn(seqRecording, CYBER.primary)}
        >
          ● REC
        </button>
        <button onClick={() => setSelectedSlot(0)} style={btn(false, CYBER.secondary)}>STEP</button>
        <span style={{ flex: 1 }} />
        <button data-testid="sequencer-clear" onClick={clearSequence} style={btn(false, CYBER.primary)} disabled={!hasAny}>
          CLEAR
        </button>
      </div>
    </div>
  );
}
