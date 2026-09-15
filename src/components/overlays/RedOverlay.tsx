// src/components/overlays/RedOverlay.tsx
import { useRef } from 'react';
import { useAppStore } from '@/store';
import type { PlayMode, StrumSpeed, ArpPattern, ArpRate, ArpChordMode, DrumKitName } from '@/audio/types';
import { sectionLabelStyle, sectionStyle, rowStyle, chipStyle } from './shared';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;
const LABEL_COLOR = '#662222';

const MODE_GRID: { value: PlayMode; label: string }[] = [
  // Row 1: Melodic
  { value: 'play', label: 'PLAY' },
  { value: 'strum', label: 'STRUM' },
  { value: 'lead', label: 'LEAD' },
  { value: 'drone', label: 'DRONE' },
  { value: 'repeat', label: 'REPEAT' },
  // Row 2: Rhythmic
  { value: 'arpeggio', label: 'ARP' },
  { value: 'sequencer', label: 'SEQ' },
  { value: 'drum', label: 'DRUM' },
  { value: 'drumLoops', label: 'LOOPS' },
  { value: 'autoDrum', label: 'AUTO' },
  // Row 3: Special
  { value: 'micSample', label: 'MIC' },
  { value: 'tuner', label: 'TUNER' },
  { value: 'chordHiro', label: 'HERO' },
  { value: 'earTrainer', label: 'EAR' },
  { value: 'mixer', label: 'MIXER' },
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

const ARP_RATES: ArpRate[] = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/16T', '1/32', 'swing8', 'swing16'];

const ARP_CHORD_MODES: { value: ArpChordMode; label: string }[] = [
  { value: 'arpOnly', label: 'ARP ONLY' },
  { value: 'chordPlusArp', label: 'CHORD+ARP' },
  { value: 'rhythmPlusArp', label: 'RHYTHM+ARP' },
];

const DRUM_KITS: { value: DrumKitName; label: string }[] = [
  { value: 'tight', label: 'TIGHT' },
  { value: 'x0x', label: 'X0X' },
  { value: 'x9x', label: 'X9X' },
  { value: 'lynn', label: 'LYNN' },
  { value: 'trap', label: 'TRAP' },
  { value: 'kr78', label: 'KR78' },
  { value: 'user', label: 'USER' },
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
  const arpChordMode = useAppStore((s) => s.arpChordMode);
  const setArpChordMode = useAppStore((s) => s.setArpChordMode);
  const drumKit = useAppStore((s) => s.drumKit);
  const setDrumKit = useAppStore((s) => s.setDrumKit);

  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current.filter((t) => now - t < 2000);
    times.push(now);
    tapTimesRef.current = times;
    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i]!);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      setBpm(newBpm);
    }
  };

  const bpmFillPct = Math.max(0, Math.min(100, ((bpm - 40) / 200) * 100));

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
          {MODE_GRID.map((m) => (
            <button
              key={m.value}
              style={{
                minWidth: 0,
                minHeight: 32,
                padding: '6px 4px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
                whiteSpace: 'nowrap',
                background: playMode === m.value ? CYBER.primary : '#1a0808',
                color: playMode === m.value ? '#fff' : '#884444',
                border: playMode === m.value ? 'none' : '1px solid #330000',
                boxShadow: playMode === m.value ? '0 0 10px ' + CYBER.primaryGlow : 'none',
              }}
              onClick={() => setPlayMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>BPM</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: '#1a0808', borderRadius: 2, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${bpmFillPct}%`,
                background: CYBER.primary,
                boxShadow: '0 0 6px ' + CYBER.primaryGlow,
                borderRadius: 2,
              }}
            />
            <input
              type="range"
              data-testid="bpm-slider"
              style={{
                position: 'absolute',
                top: -8,
                left: 0,
                width: '100%',
                height: 20,
                margin: 0,
                opacity: 0,
                cursor: 'pointer',
                touchAction: 'none',
              }}
              min={40}
              max={300}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              aria-label="BPM"
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 44, textAlign: 'right', color: CYBER.textLight }}>
            {bpm} BPM
          </span>
          <button
            style={{
              minWidth: 32,
              minHeight: 32,
              padding: '6px 10px',
              borderRadius: 4,
              background: '#1a0808',
              border: '1px solid #330000',
              color: '#884444',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            onClick={handleTapTempo}
          >
            TAP
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...sectionLabelStyle(ACCENT), color: LABEL_COLOR }}>Strum Speed</div>
        <div style={rowStyle}>
          {STRUM_SPEEDS.map((s) => (
            <button key={s.value} style={chipStyle(strumSpeed === s.value, ACCENT)} onClick={() => setStrumSpeed(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...sectionLabelStyle(ACCENT), color: LABEL_COLOR }}>Arp Pattern</div>
        <div style={rowStyle}>
          {ARP_PATTERNS.map((p) => (
            <button key={p.value} style={chipStyle(arpPattern === p.value, ACCENT)} onClick={() => setArpPattern(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...sectionLabelStyle(ACCENT), color: LABEL_COLOR }}>Arp Rate</div>
        <div style={rowStyle}>
          {ARP_RATES.map((r) => (
            <button key={r} style={chipStyle(arpRate === r, ACCENT)} onClick={() => setArpRate(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...sectionLabelStyle(ACCENT), color: LABEL_COLOR }}>Arp Chord Mode</div>
        <div style={rowStyle}>
          {ARP_CHORD_MODES.map((m) => (
            <button key={m.value} style={chipStyle(arpChordMode === m.value, ACCENT)} onClick={() => setArpChordMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...sectionLabelStyle(ACCENT), color: LABEL_COLOR }}>Drum Kit</div>
        <div style={rowStyle}>
          {DRUM_KITS.map((k) => (
            <button key={k.value} style={chipStyle(drumKit === k.value, ACCENT)} onClick={() => setDrumKit(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
