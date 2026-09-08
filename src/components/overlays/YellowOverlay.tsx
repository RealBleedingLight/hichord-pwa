// src/components/overlays/YellowOverlay.tsx
import { useAppStore } from '@/store';
import type { SynthMode, AnalogWaveform, EffectType } from '@/audio/types';
import { FM_PRESETS, ADSR_PRESETS } from '@/audio/types';
import type { ADSRPresetName } from '@/audio/types';
import type { BassMode, JoystickMode } from '@/music/types';
import {
  sectionLabelStyle, sectionStyle, rowStyle, chipStyle, toggleRowStyle, sliderStyle,
} from './shared';

const ACCENT = '#f0c040';

const SYNTH_MODES: { value: SynthMode; label: string }[] = [
  { value: 'analog', label: 'ANALOG' },
  { value: 'fm', label: 'FM' },
  { value: 'sample', label: 'SAMPLE' },
  { value: 'noise', label: 'NOISE' },
];

const WAVEFORMS: { value: AnalogWaveform; label: string }[] = [
  { value: 'sine', label: 'SINE' },
  { value: 'sawtooth', label: 'SAW' },
  { value: 'square', label: 'SQUARE' },
  { value: 'triangle', label: 'TRIANGLE' },
];

const EFFECT_META: Record<EffectType, { label: string; min: number; max: number; step: number }> = {
  filter: { label: 'FILTER', min: 20, max: 20000, step: 10 },
  reverb: { label: 'REVERB', min: 0, max: 1, step: 0.01 },
  delay: { label: 'DELAY', min: 0, max: 1, step: 0.01 },
  chorus: { label: 'CHORUS', min: 0, max: 1, step: 0.01 },
  flanger: { label: 'FLANGER', min: 0, max: 1, step: 0.01 },
  tremolo: { label: 'TREMOLO', min: 0, max: 1, step: 0.01 },
  lfoVibrato: { label: 'LFO VIBRATO', min: 0, max: 1, step: 0.01 },
  glide: { label: 'GLIDE', min: 0, max: 1, step: 0.01 },
  stereo: { label: 'STEREO', min: 0, max: 1, step: 0.01 },
  voiceCount: { label: 'VOICE COUNT', min: 1, max: 8, step: 1 },
};
const EFFECT_ORDER: EffectType[] = [
  'filter', 'reverb', 'delay', 'chorus', 'flanger', 'tremolo', 'lfoVibrato', 'glide', 'stereo', 'voiceCount',
];

const ADSR_PRESET_NAMES: ADSRPresetName[] = ['LONG', 'SHORT', 'SWELL', 'PLUCK', 'TOUCH', 'SUSTAIN'];

const BASS_MODES: { value: BassMode; label: string }[] = [
  { value: 'off', label: 'OFF' },
  { value: 'root', label: 'ROOT' },
  { value: 'slash', label: 'SLASH' },
];

const JOYSTICK_MODES: { value: JoystickMode; label: string }[] = [
  { value: 'default', label: 'DEFAULT' },
  { value: 'extended', label: 'EXTENDED' },
  { value: 'chromatic', label: 'CHROMATIC' },
];

export function YellowOverlay() {
  const synthMode = useAppStore((s) => s.synthMode);
  const setSynthMode = useAppStore((s) => s.setSynthMode);
  const waveform = useAppStore((s) => s.waveform);
  const setWaveform = useAppStore((s) => s.setWaveform);
  const fmPresetIndex = useAppStore((s) => s.fmPresetIndex);
  const setFmPresetIndex = useAppStore((s) => s.setFmPresetIndex);
  const effects = useAppStore((s) => s.effects);
  const setEffect = useAppStore((s) => s.setEffect);
  const adsr = useAppStore((s) => s.adsr);
  const setAdsr = useAppStore((s) => s.setAdsr);
  const bassMode = useAppStore((s) => s.bassMode);
  const setBassMode = useAppStore((s) => s.setBassMode);
  const voiceLeading = useAppStore((s) => s.voiceLeading);
  const setVoiceLeading = useAppStore((s) => s.setVoiceLeading);
  const joystickMode = useAppStore((s) => s.joystickMode);
  const setJoystickMode = useAppStore((s) => s.setJoystickMode);

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Instrument</div>
        <div style={rowStyle}>
          {SYNTH_MODES.map((m) => (
            <button key={m.value} style={chipStyle(synthMode === m.value, ACCENT)} onClick={() => setSynthMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {synthMode === 'analog' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>Waveform</div>
          <div style={rowStyle}>
            {WAVEFORMS.map((w) => (
              <button key={w.value} style={chipStyle(waveform === w.value, ACCENT)} onClick={() => setWaveform(w.value)}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {synthMode === 'fm' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>FM Preset</div>
          <div style={rowStyle}>
            {FM_PRESETS.map((p, i) => (
              <button key={p.name} style={chipStyle(fmPresetIndex === i, ACCENT)} onClick={() => setFmPresetIndex(i)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Effects</div>
        {EFFECT_ORDER.map((type) => {
          const meta = EFFECT_META[type];
          const state = effects[type];
          return (
            <div key={type} style={toggleRowStyle}>
              <button
                style={{ ...chipStyle(state.enabled, ACCENT), minWidth: 92, textAlign: 'left' }}
                onClick={() => setEffect(type, { enabled: !state.enabled })}
              >
                {meta.label}
              </button>
              <input
                type="range"
                style={sliderStyle}
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={state.value}
                onChange={(e) => setEffect(type, { value: parseFloat(e.target.value) })}
                aria-label={`${meta.label} value`}
              />
              <span style={{ fontSize: 10, minWidth: 36, textAlign: 'right', color: '#889' }}>
                {Number.isInteger(meta.step) ? state.value : state.value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Envelope (ADSR)</div>
        <div style={rowStyle}>
          {ADSR_PRESET_NAMES.map((name) => (
            <button
              key={name}
              style={chipStyle(
                JSON.stringify(adsr) === JSON.stringify(ADSR_PRESETS[name]),
                ACCENT,
              )}
              onClick={() => setAdsr(ADSR_PRESETS[name])}
            >
              {name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {(
            [
              { key: 'attack' as const, label: 'A', max: 2000 },
              { key: 'decay' as const, label: 'D', max: 1000 },
              { key: 'sustain' as const, label: 'S', max: 1 },
              { key: 'release' as const, label: 'R', max: 3000 },
            ]
          ).map((f) => (
            <div key={f.key} style={toggleRowStyle}>
              <span style={{ fontSize: 11, minWidth: 12, color: '#889' }}>{f.label}</span>
              <input
                type="range"
                style={sliderStyle}
                min={0}
                max={f.max}
                step={f.key === 'sustain' ? 0.01 : 1}
                value={adsr[f.key]}
                onChange={(e) => setAdsr({ ...adsr, [f.key]: parseFloat(e.target.value) })}
                aria-label={`ADSR ${f.label}`}
              />
              <span style={{ fontSize: 10, minWidth: 40, textAlign: 'right', color: '#889' }}>
                {f.key === 'sustain' ? adsr[f.key].toFixed(2) : Math.round(adsr[f.key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Bass Mode</div>
        <div style={rowStyle}>
          {BASS_MODES.map((m) => (
            <button key={m.value} style={chipStyle(bassMode === m.value, ACCENT)} onClick={() => setBassMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Voice Leading</div>
        <button style={chipStyle(voiceLeading, ACCENT)} onClick={() => setVoiceLeading(!voiceLeading)}>
          {voiceLeading ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Joystick Mode</div>
        <div style={rowStyle}>
          {JOYSTICK_MODES.map((m) => (
            <button key={m.value} style={chipStyle(joystickMode === m.value, ACCENT)} onClick={() => setJoystickMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
