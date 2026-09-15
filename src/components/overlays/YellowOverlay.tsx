// src/components/overlays/YellowOverlay.tsx
import { useAppStore } from '@/store';
import type { SynthMode, AnalogWaveform, EffectType } from '@/audio/types';
import { FM_PRESETS, ADSR_PRESETS } from '@/audio/types';
import type { ADSRPresetName } from '@/audio/types';
import {
  sectionLabelStyle, sectionStyle, rowStyle, chipStyle, sliderStyle,
} from './shared';
import { CYBER } from '@/theme';

const ACCENT = CYBER.amber;

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
  { value: 'triangle', label: 'TRI' },
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

const LABEL_COLOR = '#665520';

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

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Instrument</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SYNTH_MODES.map((m) => (
            <button
              key={m.value}
              style={{ ...chipStyle(synthMode === m.value, ACCENT), flex: 1, textAlign: 'center' }}
              onClick={() => setSynthMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {synthMode === 'analog' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Waveform</div>
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
          <div style={sectionLabelStyle(ACCENT)}>FM Preset</div>
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
        <div style={sectionLabelStyle(ACCENT)}>Envelope (ADSR)</div>
        <svg viewBox="0 0 120 28" style={{ width: 120, height: 28 }}>
          <polyline points="0,28 12,2 30,10 75,10 120,28" fill="none" stroke={CYBER.amber} strokeWidth="1.5" opacity="0.8" />
        </svg>
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
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, minWidth: 12, color: LABEL_COLOR }}>{f.label}</span>
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
              <span style={{ fontSize: 10, minWidth: 40, textAlign: 'right', color: LABEL_COLOR }}>
                {f.key === 'sustain' ? adsr[f.key].toFixed(2) : Math.round(adsr[f.key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Effects</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {EFFECT_ORDER.map((type) => {
            const meta = EFFECT_META[type];
            const state = effects[type];
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setEffect(type, { enabled: !state.enabled })}
                  aria-label={`toggle ${meta.label}`}
                  aria-pressed={state.enabled}
                  style={{
                    width: 8,
                    height: 8,
                    minWidth: 8,
                    padding: 0,
                    borderRadius: 2,
                    background: state.enabled ? CYBER.amber : 'transparent',
                    border: state.enabled ? 'none' : '1px solid #443300',
                    boxShadow: state.enabled ? '0 0 4px ' + CYBER.amberGlow : 'none',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 8, color: state.enabled ? CYBER.amber : '#665520', minWidth: 40 }}>
                  {meta.label}
                </span>
                <input
                  type="range"
                  style={{ ...sliderStyle, height: 3 }}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={state.value}
                  onChange={(e) => setEffect(type, { value: parseFloat(e.target.value) })}
                  aria-label={`${meta.label} value`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
