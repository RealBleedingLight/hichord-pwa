// src/components/overlays/GrayOverlay.tsx
import type { CSSProperties } from 'react';
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';
import type { ScaleName, BassMode, JoystickMode } from '@/music/types';
import { sectionLabelStyle, sectionStyle, rowStyle, chipStyle, stepperButtonStyle } from './shared';
import { CYBER } from '@/theme';

const SCALES: { value: ScaleName; label: string }[] = [
  { value: 'major', label: 'MAJOR' },
  { value: 'naturalMinor', label: 'MINOR' },
  { value: 'dorian', label: 'DORIAN' },
  { value: 'mixolydian', label: 'MIXO' },
  { value: 'lydian', label: 'LYDIAN' },
  { value: 'majorPentatonic', label: 'PENTA▲' },
  { value: 'minorPentatonic', label: 'PENTA▼' },
  { value: 'blues', label: 'BLUES' },
  { value: 'harmonicMinor', label: 'HARM.m' },
  { value: 'melodicMinor', label: 'MELO.m' },
];

const BASS_MODES: { value: BassMode; label: string }[] = [
  { value: 'off', label: 'OFF' },
  { value: 'root', label: 'ROOT' },
  { value: 'slash', label: 'FIFTH' },
];

const JOYSTICK_MODES: { value: JoystickMode; label: string }[] = [
  { value: 'default', label: 'DEFAULT' },
  { value: 'extended', label: 'EXT' },
  { value: 'chromatic', label: 'CHROM' },
];

const ACCENT = CYBER.secondary;
const GRAY_ACCENT = '#aaa';

function grayChipStyle(active: boolean): CSSProperties {
  return {
    minWidth: 32,
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 4,
    border: 'none',
    background: active ? GRAY_ACCENT : '#1a1a1a',
    color: active ? '#000' : '#888',
    boxShadow: active ? '0 0 6px rgba(170,170,170,.3)' : 'none',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  };
}

export function GrayOverlay() {
  const key = useAppStore((s) => s.key);
  const setKey = useAppStore((s) => s.setKey);
  const scale = useAppStore((s) => s.scale);
  const setScale = useAppStore((s) => s.setScale);
  const globalOctave = useAppStore((s) => s.globalOctave);
  const setGlobalOctave = useAppStore((s) => s.setGlobalOctave);
  const buttonOctaves = useAppStore((s) => s.buttonOctaves);
  const setButtonOctave = useAppStore((s) => s.setButtonOctave);
  const bassMode = useAppStore((s) => s.bassMode);
  const setBassMode = useAppStore((s) => s.setBassMode);
  const voiceLeading = useAppStore((s) => s.voiceLeading);
  const setVoiceLeading = useAppStore((s) => s.setVoiceLeading);
  const joystickMode = useAppStore((s) => s.joystickMode);
  const setJoystickMode = useAppStore((s) => s.setJoystickMode);

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Key</div>
        <div style={rowStyle}>
          {ALL_KEYS.map((k) => (
            <button key={k} style={chipStyle(key === k, ACCENT)} onClick={() => setKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Octave</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={stepperButtonStyle()}
            onClick={() => setGlobalOctave(globalOctave - 1)}
            disabled={globalOctave <= -1}
          >
            −
          </button>
          <span style={{ minWidth: 24, textAlign: 'center', color: CYBER.textLight, fontWeight: 700 }}>{globalOctave}</span>
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
        <div style={sectionLabelStyle(ACCENT)}>Scale</div>
        <div style={rowStyle}>
          {SCALES.map((s) => (
            <button key={s.value} style={chipStyle(scale === s.value, ACCENT)} onClick={() => setScale(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Per-button octave shift</div>
        <div style={rowStyle}>
          {buttonOctaves.map((oct, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, color: '#666' }}>{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  style={{ ...stepperButtonStyle(), fontSize: 11 }}
                  onClick={() => setButtonOctave(i, oct - 1)}
                  disabled={oct <= -2}
                  aria-label={`button ${i + 1} octave down`}
                >
                  −
                </button>
                <span style={{ minWidth: 16, textAlign: 'center', fontSize: 11, color: CYBER.textLight }}>{oct}</span>
                <button
                  style={{ ...stepperButtonStyle(), fontSize: 11 }}
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

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Bass</div>
        <div style={rowStyle}>
          {BASS_MODES.map((m) => (
            <button key={m.value} style={grayChipStyle(bassMode === m.value)} onClick={() => setBassMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>V.Lead</div>
        <button
          style={{
            width: 30,
            height: 16,
            borderRadius: 8,
            background: '#1a1a1a',
            border: '1px solid #333',
            position: 'relative',
            cursor: 'pointer',
            padding: 0,
          }}
          onClick={() => setVoiceLeading(!voiceLeading)}
          aria-label="voice leading toggle"
          aria-pressed={voiceLeading}
        >
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: voiceLeading ? 15 : 1,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: voiceLeading ? GRAY_ACCENT : '#666',
              boxShadow: voiceLeading ? '0 0 6px rgba(170,170,170,.5)' : 'none',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Joystick</div>
        <div style={rowStyle}>
          {JOYSTICK_MODES.map((m) => (
            <button key={m.value} style={grayChipStyle(joystickMode === m.value)} onClick={() => setJoystickMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
