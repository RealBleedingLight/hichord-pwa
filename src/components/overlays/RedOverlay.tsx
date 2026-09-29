// src/components/overlays/RedOverlay.tsx
import { useRef } from 'react';
import { useAppStore } from '@/store';
import type { PlayMode, StrumSpeed, ArpPattern, ArpRate, DrumKitName } from '@/audio/types';
import { sectionLabelStyle, sectionStyle, rowStyle, chipStyle } from './shared';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;

const MODE_GROUPS: { title: string; modes: { value: PlayMode; label: string; help: string }[] }[] = [
  {
    title: 'Play chords',
    modes: [
      { value: 'play', label: 'PLAY', help: 'Hold a key, the chord sounds; let go, it stops.' },
      { value: 'strum', label: 'STRUM', help: 'Notes roll in low → high like a guitar strum.' },
      { value: 'arpeggio', label: 'ARP', help: 'Held chords are played one note at a time, in tempo.' },
      { value: 'repeat', label: 'REPEAT', help: 'Held chords re-trigger rhythmically, in tempo.' },
      { value: 'lead', label: 'LEAD', help: 'Only the top note of each chord — for melodies.' },
      { value: 'drone', label: 'DRONE', help: 'Chords keep ringing after you let go, until the next one.' },
    ],
  },
  {
    title: 'Build a song',
    modes: [
      { value: 'sequencer', label: 'SEQ', help: 'Write a 4-bar chord progression that plays with the beat.' },
      { value: 'drumLoops', label: 'BEATS', help: 'Pick and edit the groove that ▶ plays.' },
      { value: 'drum', label: 'PADS', help: 'Finger-drum on 16 pads (chord keys play drums too).' },
      { value: 'autoDrum', label: 'AUTO DRUM', help: 'Hold a pad and it repeats at the arp rate.' },
      { value: 'mixer', label: 'LOOPER', help: 'Record, mute and clear the 6 loop layers.' },
    ],
  },
  {
    title: 'Tools & games',
    modes: [
      { value: 'micSample', label: 'MIC', help: 'Record your voice or any sound and play it as an instrument.' },
      { value: 'tuner', label: 'TUNER', help: 'Tune a guitar or voice with the mic.' },
      { value: 'chordHiro', label: 'HERO', help: 'Rhythm game: hit the falling chords in time.' },
      { value: 'earTrainer', label: 'EAR', help: 'Hear a chord, name its type.' },
    ],
  },
];

const STRUM_SPEEDS: { value: StrumSpeed; label: string }[] = [
  { value: 'slow', label: 'SLOW' },
  { value: 'medium', label: 'MED' },
  { value: 'fast', label: 'FAST' },
];

const ARP_PATTERNS: { value: ArpPattern; label: string }[] = [
  { value: 'up', label: 'UP' },
  { value: 'down', label: 'DOWN' },
  { value: 'upDown', label: 'UP-DN' },
  { value: 'downUp', label: 'DN-UP' },
  { value: 'random', label: 'RAND' },
  { value: 'fingerpick', label: 'FPICK' },
];

const RATE_LABELS: Record<ArpRate, string> = {
  '1/1': '1/1', '1/2': '1/2', '1/4': '1/4', '1/8': '1/8', '1/16': '1/16',
  '1/16T': '1/16T', '1/32': '1/32', swing8: 'SWING 8', swing16: 'SWING 16',
};
const ARP_RATES: ArpRate[] = ['1/4', '1/8', '1/16', '1/16T', '1/32', '1/2', '1/1'];

const DRUM_KITS: { value: DrumKitName; label: string }[] = [
  { value: 'tight', label: 'TIGHT' },
  { value: 'x0x', label: '808' },
  { value: 'x9x', label: '909' },
  { value: 'lynn', label: 'LYNN' },
  { value: 'kr78', label: 'KR78' },
  { value: 'trap', label: 'TRAP' },
];

export function RedOverlay() {
  const playMode = useAppStore((s) => s.playMode);
  const setPlayMode = useAppStore((s) => s.setPlayMode);
  const bpm = useAppStore((s) => s.bpm);
  const setBpm = useAppStore((s) => s.setBpm);
  const strumSpeed = useAppStore((s) => s.strumSpeed);
  const setStrumSpeed = useAppStore((s) => s.setStrumSpeed);
  const arpPattern = useAppStore((s) => s.arpPattern);
  const setArpPattern = useAppStore((s) => s.setArpPattern);
  const arpRate = useAppStore((s) => s.arpRate);
  const setArpRate = useAppStore((s) => s.setArpRate);
  const drumKit = useAppStore((s) => s.drumKit);
  const setDrumKit = useAppStore((s) => s.setDrumKit);

  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current.filter((t) => now - t < 2000);
    times.push(now);
    tapTimesRef.current = times.slice(-6);
    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i]!);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avg));
    }
  };

  const bpmFillPct = Math.max(0, Math.min(100, ((bpm - 40) / 260) * 100));
  const current = MODE_GROUPS.flatMap((g) => g.modes).find((m) => m.value === playMode);
  const usesRate = playMode === 'arpeggio' || playMode === 'repeat' || playMode === 'autoDrum';
  const usesKit = playMode === 'drum' || playMode === 'drumLoops' || playMode === 'autoDrum';

  return (
    <div>
      {MODE_GROUPS.map((group) => (
        <div key={group.title} style={{ ...sectionStyle, marginBottom: 8 }}>
          <div style={sectionLabelStyle(ACCENT)}>{group.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 4 }}>
            {group.modes.map((m) => (
              <button
                key={m.value}
                style={{
                  minWidth: 0,
                  minHeight: 34,
                  padding: '6px 4px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  whiteSpace: 'nowrap',
                  background: playMode === m.value ? CYBER.primary : '#1f0a0a',
                  color: playMode === m.value ? '#fff' : '#e09090',
                  border: playMode === m.value ? 'none' : '1px solid #3a1010',
                  boxShadow: playMode === m.value ? '0 0 10px ' + CYBER.primaryGlow : 'none',
                }}
                onClick={() => setPlayMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {current && (
        <div style={{ fontSize: 12, color: '#ddd', margin: '0 0 12px', padding: '6px 8px', background: '#1a0a0a', borderRadius: 4 }}>
          <b style={{ color: CYBER.primary }}>{current.label}</b> — {current.help}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Tempo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: '#2a0c0c', borderRadius: 2, position: 'relative' }}>
            <div
              style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: `${bpmFillPct}%`,
                background: CYBER.primary, boxShadow: '0 0 6px ' + CYBER.primaryGlow, borderRadius: 2,
              }}
            />
            <input
              type="range"
              data-testid="bpm-slider"
              style={{ position: 'absolute', top: -10, left: 0, width: '100%', height: 24, margin: 0, opacity: 0, cursor: 'pointer', touchAction: 'none' }}
              min={40}
              max={300}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              aria-label="BPM"
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'right', color: CYBER.textLight }}>
            {bpm} BPM
          </span>
          <button
            style={{
              minWidth: 56, minHeight: 34, padding: '6px 10px', borderRadius: 4,
              background: '#1f0a0a', border: '1px solid #3a1010', color: '#e09090',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
            }}
            onPointerDown={handleTapTempo}
          >
            TAP
          </button>
        </div>
      </div>

      {playMode === 'strum' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Strum Speed</div>
          <div style={rowStyle}>
            {STRUM_SPEEDS.map((s) => (
              <button key={s.value} style={chipStyle(strumSpeed === s.value, ACCENT)} onClick={() => setStrumSpeed(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {playMode === 'arpeggio' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Arp Pattern</div>
          <div style={rowStyle}>
            {ARP_PATTERNS.map((p) => (
              <button key={p.value} style={chipStyle(arpPattern === p.value, ACCENT)} onClick={() => setArpPattern(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {usesRate && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Rate</div>
          <div style={rowStyle}>
            {ARP_RATES.map((r) => (
              <button key={r} style={chipStyle(arpRate === r, ACCENT)} onClick={() => setArpRate(r)}>
                {RATE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      {usesKit && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Drum Kit</div>
          <div style={rowStyle}>
            {DRUM_KITS.map((k) => (
              <button key={k.value} style={chipStyle(drumKit === k.value, ACCENT)} onClick={() => setDrumKit(k.value)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
