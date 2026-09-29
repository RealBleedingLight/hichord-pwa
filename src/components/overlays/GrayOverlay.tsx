// src/components/overlays/GrayOverlay.tsx
import { useMemo, type CSSProperties } from 'react';
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';
import type { ScaleName, BassMode, JoystickMode, Inversion } from '@/music/types';
import { getDegreeLabels, getChord, directionLabel } from '@/music/chord-engine';

const INVERSION_LABELS = ['ROOT', '1ST INV', '2ND INV'];
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
  { value: 'slash', label: 'FIFTH BELOW' },
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
    background: active ? GRAY_ACCENT : '#1e1e1e',
    color: active ? '#000' : '#b8b8b8',
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
  const inversions = useAppStore((s) => s.inversions);
  const setInversion = useAppStore((s) => s.setInversion);
  const degreeLabels = useMemo(() => getDegreeLabels(key, scale), [key, scale]);
  const chordLocks = useAppStore((s) => s.chordLocks);
  const toggleChordLock = useAppStore((s) => s.toggleChordLock);

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
        <div style={sectionLabelStyle(ACCENT)}>Per-chord octave &amp; inversion</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {degreeLabels.map((label, i) => {
            const oct = buttonOctaves[i] ?? 0;
            const inv = inversions[i] ?? 0;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: '#161616', borderRadius: 4, padding: '4px 2px' }}>
                <span style={{ fontSize: 12, color: CYBER.textLight, fontWeight: 700 }}>{label.name}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{label.roman}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    style={{ ...stepperButtonStyle(), minWidth: 24, minHeight: 26, fontSize: 12 }}
                    onClick={() => setButtonOctave(i, oct - 1)}
                    disabled={oct <= -2}
                    aria-label={`button ${i + 1} octave down`}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 18, textAlign: 'center', fontSize: 11, color: CYBER.textLight }}>{oct > 0 ? `+${oct}` : oct}</span>
                  <button
                    style={{ ...stepperButtonStyle(), minWidth: 24, minHeight: 26, fontSize: 12 }}
                    onClick={() => setButtonOctave(i, oct + 1)}
                    disabled={oct >= 1}
                    aria-label={`button ${i + 1} octave up`}
                  >
                    +
                  </button>
                </div>
                <button
                  style={{ ...grayChipStyle(inv > 0), minWidth: 0, minHeight: 24, padding: '2px 6px', fontSize: 10 }}
                  onClick={() => setInversion(i, ((inv + 1) % 3) as Inversion)}
                  aria-label={`button ${i + 1} inversion`}
                >
                  {INVERSION_LABELS[inv]}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Chord locks <span style={{ textTransform: 'none', fontWeight: 400, color: '#999' }}>— hold a key + move the pad, then tap 🔒 LOCK (or E)</span></div>
        <div style={rowStyle}>
          {chordLocks.length === 0 && <span style={{ fontSize: 12, color: '#888' }}>None yet</span>}
          {chordLocks.map((lock) => {
            const chord = getChord(key, scale, lock.degree, 4, lock.direction, joystickMode, 0, 'off', []);
            return (
              <button
                key={lock.degree}
                aria-label={`Unlock ${chord.displayName}`}
                style={grayChipStyle(true)}
                onClick={() => toggleChordLock(lock.degree, lock.direction)}
              >
                🔒 {degreeLabels[lock.degree - 1]?.roman} → {chord.displayName} ({directionLabel(lock.direction, joystickMode)}) ✕
              </button>
            );
          })}
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
        <div style={sectionLabelStyle(ACCENT)}>Voice leading <span style={{ textTransform: 'none', fontWeight: 400, color: '#999' }}>— smooth, close movement between chords</span></div>
        <button
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
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
              top: 3,
              left: voiceLeading ? 23 : 3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: voiceLeading ? GRAY_ACCENT : '#666',
              boxShadow: voiceLeading ? '0 0 6px rgba(170,170,170,.5)' : 'none',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Pad chord set</div>
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
