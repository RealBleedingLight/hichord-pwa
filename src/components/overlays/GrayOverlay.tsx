// src/components/overlays/GrayOverlay.tsx
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';
import type { ScaleName } from '@/music/types';
import { sectionLabelStyle, sectionStyle, rowStyle, chipStyle, stepperButtonStyle } from './shared';

const SCALES: { value: ScaleName; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'naturalMinor', label: 'Natural Minor' },
  { value: 'harmonicMinor', label: 'Harmonic Minor' },
  { value: 'melodicMinor', label: 'Melodic Minor' },
  { value: 'majorPentatonic', label: 'Major Pentatonic' },
  { value: 'minorPentatonic', label: 'Minor Pentatonic' },
  { value: 'blues', label: 'Blues' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'lydian', label: 'Lydian' },
];

const ACCENT = '#aaaaaa';

export function GrayOverlay() {
  const key = useAppStore((s) => s.key);
  const setKey = useAppStore((s) => s.setKey);
  const scale = useAppStore((s) => s.scale);
  const setScale = useAppStore((s) => s.setScale);
  const globalOctave = useAppStore((s) => s.globalOctave);
  const setGlobalOctave = useAppStore((s) => s.setGlobalOctave);
  const buttonOctaves = useAppStore((s) => s.buttonOctaves);
  const setButtonOctave = useAppStore((s) => s.setButtonOctave);

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Key</div>
        <div style={rowStyle}>
          {ALL_KEYS.map((k) => (
            <button key={k} style={chipStyle(key === k, ACCENT)} onClick={() => setKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Octave</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={stepperButtonStyle()}
            onClick={() => setGlobalOctave(globalOctave - 1)}
            disabled={globalOctave <= -1}
          >
            −
          </button>
          <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{globalOctave}</span>
          <button
            style={stepperButtonStyle()}
            onClick={() => setGlobalOctave(globalOctave + 1)}
            disabled={globalOctave >= 2}
          >
            +
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Scale</div>
        <select
          value={scale}
          onChange={(e) => setScale(e.target.value as ScaleName)}
          style={{
            minHeight: 32,
            padding: '4px 8px',
            borderRadius: 6,
            background: '#0f1626',
            color: '#cdd',
            border: 'none',
            fontSize: 12,
          }}
        >
          {SCALES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Per-button octave shift</div>
        <div style={rowStyle}>
          {buttonOctaves.map((oct, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, color: '#667' }}>{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  style={{ ...stepperButtonStyle(), minWidth: 24, minHeight: 24, fontSize: 11 }}
                  onClick={() => setButtonOctave(i, oct - 1)}
                  disabled={oct <= -2}
                  aria-label={`button ${i + 1} octave down`}
                >
                  −
                </button>
                <span style={{ minWidth: 16, textAlign: 'center', fontSize: 11 }}>{oct}</span>
                <button
                  style={{ ...stepperButtonStyle(), minWidth: 24, minHeight: 24, fontSize: 11 }}
                  onClick={() => setButtonOctave(i, oct + 1)}
                  disabled={oct >= 1}
                  aria-label={`button ${i + 1} octave up`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
