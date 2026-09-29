// src/components/ChordDisplay.tsx
import { useMemo } from 'react';
import { useAppStore, SECTION_NAMES } from '@/store';
import { getChord } from '@/music/chord-engine';
import { CYBER } from '@/theme';

const MODE_HINTS: Record<string, string> = {
  play: 'Hold a chord key to play',
  strum: 'Chords are strummed low → high',
  lead: 'Plays the top note only — melody lines',
  drone: 'Chords sustain until the next one',
  repeat: 'Held chords re-trigger in time',
  arpeggio: 'Held chords are arpeggiated in time',
};

/** Two octaves starting at C3; notes outside are folded in so they always show. */
const KEYBOARD_START = 48;
const KEYBOARD_KEYS = 36;
const BLACK = new Set([1, 3, 6, 8, 10]);

function MiniKeyboard({ midi }: { midi: number[] }) {
  const lit = new Set(midi.map((m) => {
    let n = m;
    while (n < KEYBOARD_START) n += 12;
    while (n >= KEYBOARD_START + KEYBOARD_KEYS) n -= 12;
    return n;
  }));
  const whites: number[] = [];
  for (let m = KEYBOARD_START; m < KEYBOARD_START + KEYBOARD_KEYS; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const w = 100 / whites.length;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: 64 }} aria-hidden>
      {whites.map((m, i) => (
        <rect key={m} x={i * w + 0.15} y={0} width={w - 0.3} height={24} rx={0.6}
          fill={lit.has(m) ? CYBER.primary : '#262626'} />
      ))}
      {whites.map((m, i) => {
        const black = m + 1;
        if (!BLACK.has(black % 12) || black >= KEYBOARD_START + KEYBOARD_KEYS) return null;
        return (
          <rect key={black} x={(i + 1) * w - w * 0.3} y={0} width={w * 0.6} height={14} rx={0.4}
            fill={lit.has(black) ? '#ff6680' : '#050505'} />
        );
      })}
    </svg>
  );
}

/**
 * The last chords you played, oldest → newest. Jam until something sounds
 * good, then send it to the sequencer in one tap.
 */
function RecentChords() {
  const recent = useAppStore((s) => s.recentChords);
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  const joystickMode = useAppStore((s) => s.joystickMode);
  const editSection = useAppStore((s) => s.editSection);
  const capture = useAppStore((s) => s.captureRecentToSection);
  const clear = useAppStore((s) => s.clearRecentChords);
  const names = useMemo(
    () => recent.map((c) => getChord(key, scale, c.degree, 4, c.direction, joystickMode, 0, 'off', []).displayName),
    [recent, key, scale, joystickMode],
  );
  const btn: React.CSSProperties = {
    height: 30, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1,
    cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0, fontFamily: CYBER.fontMono,
  };
  return (
    <div data-testid="recent-chords" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4, minHeight: 30 }}>
        {names.length === 0 && (
          <span style={{ fontSize: 11, color: CYBER.textDim, alignSelf: 'center' }}>Recent chords show up here</span>
        )}
        {names.map((n, i) => (
          <span key={i} style={{
            flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '6px 2px', borderRadius: 5,
            background: i === names.length - 1 ? '#3a0c14' : '#1c0707', border: '1px solid ' + CYBER.border,
            color: CYBER.textLight, fontFamily: CYBER.fontDisplay, fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{n}</span>
        ))}
      </div>
      {names.length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button data-testid="capture-recent" onClick={capture}
            style={{ ...btn, background: CYBER.secondary, color: '#000', border: 'none' }}>
            → SEQ {SECTION_NAMES[editSection]}
          </button>
          <button onClick={clear} style={{ ...btn, background: 'transparent', color: CYBER.textMid, border: '1px solid ' + CYBER.border }}>
            CLEAR
          </button>
        </div>
      )}
    </div>
  );
}

export function ChordDisplay() {
  const chordName = useAppStore((s) => s.currentChordName);
  const chordMidi = useAppStore((s) => s.currentChordMidi);
  const playMode = useAppStore((s) => s.playMode);
  const synthMode = useAppStore((s) => s.synthMode);
  const sampleName = useAppStore((s) => s.sampleName);
  const arpPattern = useAppStore((s) => s.arpPattern);
  const arpRate = useAppStore((s) => s.arpRate);
  const hasPlayed = chordName !== '';

  let modeLine = MODE_HINTS[playMode] ?? '';
  if (playMode === 'arpeggio') modeLine = `Arp ${arpPattern} · ${arpRate}`;
  const soundLine = synthMode === 'sample' ? `SAMPLE · ${sampleName.toUpperCase()}` : synthMode.toUpperCase();

  return (
    <div data-testid="chord-display" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8,
      background: CYBER.panel,
      border: '1px solid ' + CYBER.border,
      borderRadius: 8,
      padding: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: CYBER.fontDisplay,
        fontSize: 'clamp(24px, 6vw, 44px)', fontWeight: 900,
        color: CYBER.textLight,
        textShadow: '0 0 20px ' + CYBER.secondaryGlow,
        letterSpacing: 2,
        minHeight: '1.2em',
        whiteSpace: 'nowrap',
      }}>{hasPlayed ? chordName : '—'}</div>

      <MiniKeyboard midi={chordMidi} />

      <RecentChords />

      <div style={{ fontSize: 12, color: CYBER.textDim, textAlign: 'center', lineHeight: 1.4 }}>
        {hasPlayed ? (
          <>
            <span style={{ color: CYBER.primary, letterSpacing: 2 }}>{soundLine}</span>
            {modeLine && <> · {modeLine}</>}
          </>
        ) : (
          <>Hold a <b style={{ color: CYBER.textLight }}>chord key</b> (right) and slide on the <b style={{ color: CYBER.textLight }}>pad</b> (left) to colour it.<br />
            Press <b style={{ color: CYBER.secondary }}>▶</b> below for a beat. <span style={{ opacity: 0.8 }}>Keyboard: H U J K L O ; · ? for help</span></>
        )}
      </div>
    </div>
  );
}
