// src/components/overlays/RedOverlay.tsx
import { useRef } from 'react';
import { useAppStore } from '@/store';
import type { PlayMode, StrumSpeed, ArpPattern, ArpRate, ArpChordMode, DrumKitName } from '@/audio/types';
import { sectionLabelStyle, sectionStyle, rowStyle, chipStyle, sliderStyle } from './shared';

const ACCENT = '#e04040';

const PLAY_MODES: { value: PlayMode; label: string }[] = [
  { value: 'play', label: 'PLAY' },
  { value: 'strum', label: 'STRUM' },
  { value: 'lead', label: 'LEAD' },
  { value: 'drone', label: 'DRONE' },
  { value: 'arpeggio', label: 'ARPEGGIO' },
  { value: 'repeat', label: 'REPEAT' },
  { value: 'micSample', label: 'MIC SAMPLE' },
  { value: 'drum', label: 'DRUM' },
  { value: 'drumLoops', label: 'DRUM LOOPS' },
  { value: 'autoDrum', label: 'AUTO DRUM' },
  { value: 'sequencer', label: 'SEQUENCER' },
  { value: 'chordHiro', label: 'CHORD HIRO' },
  { value: 'earTrainer', label: 'EAR TRAINER' },
  { value: 'tuner', label: 'TUNER' },
  { value: 'mixer', label: 'MIXER' },
];

const STRUM_SPEEDS: { value: StrumSpeed; label: string }[] = [
  { value: 'slow', label: 'SLOW' },
  { value: 'medium', label: 'MEDIUM' },
  { value: 'fast', label: 'FAST' },
];

const ARP_PATTERNS: { value: ArpPattern; label: string }[] = [
  { value: 'up', label: 'UP' },
  { value: 'down', label: 'DOWN' },
  { value: 'upDown', label: 'UP-DOWN' },
  { value: 'downUp', label: 'DOWN-UP' },
  { value: 'random', label: 'RANDOM' },
  { value: 'fingerpick', label: 'FINGERPICK' },
];

const ARP_RATES: ArpRate[] = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/16T', '1/32', 'swing8', 'swing16'];

const ARP_CHORD_MODES: { value: ArpChordMode; label: string }[] = [
  { value: 'arpOnly', label: 'ARP ONLY' },
  { value: 'chordPlusArp', label: 'CHORD+ARP' },
  { value: 'rhythmPlusArp', label: 'RHYTHM+ARP' },
];

const DRUM_KITS: DrumKitName[] = ['tight', 'x0x', 'x9x', 'lynn', 'kr78', 'trap', 'user'];

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

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Mode</div>
        <div style={rowStyle}>
          {PLAY_MODES.map((m) => (
            <button key={m.value} style={chipStyle(playMode === m.value, ACCENT)} onClick={() => setPlayMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Tempo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            data-testid="bpm-slider"
            style={sliderStyle}
            min={40}
            max={300}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            aria-label="BPM"
          />
          <span style={{ fontSize: 12, minWidth: 44, textAlign: 'right' }}>{bpm} BPM</span>
          <button style={chipStyle(false, ACCENT)} onClick={handleTapTempo}>TAP</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Strum Speed</div>
        <div style={rowStyle}>
          {STRUM_SPEEDS.map((s) => (
            <button key={s.value} style={chipStyle(strumSpeed === s.value, ACCENT)} onClick={() => setStrumSpeed(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Arp Pattern</div>
        <div style={rowStyle}>
          {ARP_PATTERNS.map((p) => (
            <button key={p.value} style={chipStyle(arpPattern === p.value, ACCENT)} onClick={() => setArpPattern(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Arp Rate</div>
        <div style={rowStyle}>
          {ARP_RATES.map((r) => (
            <button key={r} style={chipStyle(arpRate === r, ACCENT)} onClick={() => setArpRate(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Arp Chord Mode</div>
        <div style={rowStyle}>
          {ARP_CHORD_MODES.map((m) => (
            <button key={m.value} style={chipStyle(arpChordMode === m.value, ACCENT)} onClick={() => setArpChordMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Drum Kit</div>
        <div style={rowStyle}>
          {DRUM_KITS.map((k) => (
            <button key={k} style={chipStyle(drumKit === k, ACCENT)} onClick={() => setDrumKit(k)}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
