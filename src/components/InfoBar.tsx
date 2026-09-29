// src/components/InfoBar.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

const SCALE_NAMES: Record<string, string> = {
  major: 'major', naturalMinor: 'minor', harmonicMinor: 'harm. minor', melodicMinor: 'mel. minor',
  majorPentatonic: 'major penta', minorPentatonic: 'minor penta', blues: 'blues',
  dorian: 'dorian', mixolydian: 'mixolydian', lydian: 'lydian',
};

const MODE_NAMES: Record<string, string> = {
  play: 'PLAY', strum: 'STRUM', lead: 'LEAD', drone: 'DRONE', repeat: 'REPEAT', arpeggio: 'ARP',
  sequencer: 'SEQUENCER', drum: 'DRUM PADS', drumLoops: 'BEATS', autoDrum: 'AUTO DRUM',
  micSample: 'MIC SAMPLE', tuner: 'TUNER', chordHiro: 'CHORD HERO', earTrainer: 'EAR TRAINER', mixer: 'LOOPER',
};

export function InfoBar() {
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  const playMode = useAppStore((s) => s.playMode);
  const chordName = useAppStore((s) => s.currentChordName);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      fontSize: 13,
      fontFamily: CYBER.fontMono,
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setActiveOverlay('gray')}
        style={{ background: 'none', border: 'none', color: CYBER.secondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: CYBER.fontMono, whiteSpace: 'nowrap' }}
      >
        {key} {SCALE_NAMES[scale] ?? scale}
      </button>
      <span style={{ fontFamily: CYBER.fontDisplay, fontWeight: 700, color: CYBER.textLight, fontSize: 16, minWidth: 60, whiteSpace: 'nowrap' }}>{chordName || '—'}</span>
      <button
        onClick={() => setActiveOverlay('red')}
        style={{ background: 'none', border: 'none', color: CYBER.primary, fontSize: 12, cursor: 'pointer', fontFamily: CYBER.fontMono, letterSpacing: 1, whiteSpace: 'nowrap' }}
      >
        {MODE_NAMES[playMode] ?? playMode}
      </button>
      <button
        aria-label="Help"
        onClick={() => setActiveOverlay('help')}
        style={{
          width: 28, height: 28, borderRadius: '50%', border: '1px solid ' + CYBER.borderBright,
          background: 'transparent', color: CYBER.textMid, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}
      >
        ?
      </button>
    </div>
  );
}
