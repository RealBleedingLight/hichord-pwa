// src/components/overlays/YellowOverlay.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import type { SynthMode, AnalogWaveform, EffectType, Preset } from '@/audio/types';
import { FM_PRESETS, ADSR_PRESETS } from '@/audio/types';
import type { ADSRPresetName } from '@/audio/types';
import { BUILTIN_INSTRUMENTS } from '@/audio/instruments';
import { FACTORY_PRESETS } from '@/data/presets';
import { getDB } from '@/db';
import { applyPresetToStore, stateToPreset } from '@/data/preset-state';
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

/** Effects that are wired into the audio chain. */
const EFFECTS: { type: EffectType; label: string }[] = [
  { type: 'filter', label: 'FILTER' },
  { type: 'reverb', label: 'REVERB' },
  { type: 'delay', label: 'DELAY' },
  { type: 'chorus', label: 'CHORUS' },
  { type: 'flanger', label: 'FLANGER' },
  { type: 'tremolo', label: 'TREMOLO' },
];

/** Controls that shape each voice rather than the mix. */
const VOICE_CONTROLS: { type: EffectType; label: string }[] = [
  { type: 'lfoVibrato', label: 'VIBRATO' },
  { type: 'glide', label: 'GLIDE' },
  { type: 'stereo', label: 'WIDTH' },
];

const VOICE_LIMITS = [1, 2, 3, 4, 6];

function LatencySection() {
  const audioLatency = useAppStore((s) => s.audioLatency);
  const setAudioLatency = useAppStore((s) => s.setAudioLatency);
  const measured = useAppStore((s) => s.measuredLatencyMs);
  const options = [
    { value: 'lowest' as const, label: 'LOWEST', help: 'fastest response, may crackle on slow phones' },
    { value: 'balanced' as const, label: 'BALANCED', help: 'recommended' },
    { value: 'safe' as const, label: 'SAFE', help: 'most stable, slower response' },
  ];
  const current = options.find((o) => o.value === audioLatency);
  return (
    <div style={sectionStyle}>
      <div style={sectionLabelStyle(ACCENT)}>
        Touch → sound delay{' '}
        <span style={{ textTransform: 'none', fontWeight: 400, color: '#999' }}>
          {measured > 0 ? `— output ≈ ${measured} ms` : ''} · {current?.help}
        </span>
      </div>
      <div style={rowStyle}>
        {options.map((o) => (
          <button key={o.value} data-testid={`latency-${o.value}`} style={chipStyle(audioLatency === o.value, ACCENT)} onClick={() => setAudioLatency(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MidiSection() {
  const midiEnabled = useAppStore((s) => s.midiEnabled);
  const setMidiEnabled = useAppStore((s) => s.setMidiEnabled);
  const midiOutputs = useAppStore((s) => s.midiOutputs);
  const midiOutputId = useAppStore((s) => s.midiOutputId);
  const setMidiOutputId = useAppStore((s) => s.setMidiOutputId);
  const selected = midiOutputId ?? midiOutputs[0]?.id;
  return (
    <div style={sectionStyle}>
      <div style={sectionLabelStyle(ACCENT)}>MIDI out <span style={{ textTransform: 'none', fontWeight: 400, color: '#999' }}>— play an external synth / DAW (channel 1)</span></div>
      <div style={rowStyle}>
        <button data-testid="midi-toggle" style={chipStyle(midiEnabled, ACCENT)} onClick={() => setMidiEnabled(!midiEnabled)}>
          {midiEnabled ? 'ON' : 'OFF'}
        </button>
        {midiEnabled && midiOutputs.length === 0 && <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>No devices found</span>}
        {midiEnabled && midiOutputs.map((o) => (
          <button key={o.id} style={chipStyle(selected === o.id, ACCENT)} onClick={() => setMidiOutputId(o.id)}>{o.name}</button>
        ))}
      </div>
    </div>
  );
}

/** Filter cutoff is exponential in feel; the slider works in 0–1 and maps to 80 Hz–20 kHz. */
const FILTER_MIN = 80;
const FILTER_MAX = 20000;
const cutoffToSlider = (hz: number) => Math.log(Math.max(FILTER_MIN, hz) / FILTER_MIN) / Math.log(FILTER_MAX / FILTER_MIN);
const sliderToCutoff = (v: number) => Math.round(FILTER_MIN * Math.pow(FILTER_MAX / FILTER_MIN, v));

const ADSR_PRESET_NAMES: ADSRPresetName[] = ['TOUCH', 'PLUCK', 'SHORT', 'SUSTAIN', 'LONG', 'SWELL'];

const LABEL_COLOR = '#c9a84a';

function effectToggleStyle(enabled: boolean): React.CSSProperties {
  return {
    minWidth: 78, height: 30, padding: '0 8px', borderRadius: 4,
    background: enabled ? CYBER.amber : 'transparent',
    border: '1px solid ' + (enabled ? CYBER.amber : '#554420'),
    color: enabled ? '#000' : LABEL_COLOR,
    fontSize: 10, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
  };
}

function AdsrCurve({ attack, decay, sustain, release }: { attack: number; decay: number; sustain: number; release: number }) {
  // Scale times so the whole shape fits; hold the sustain for a fixed width.
  const total = attack + decay + release + 400;
  const w = 160;
  const h = 32;
  const x1 = (attack / total) * w;
  const x2 = x1 + (decay / total) * w;
  const x3 = x2 + (400 / total) * w;
  const x4 = w;
  const sy = h - sustain * (h - 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: 160, height: 32 }} aria-hidden>
      <polyline points={`0,${h} ${x1},2 ${x2},${sy} ${x3},${sy} ${x4},${h}`} fill="none" stroke={CYBER.amber} strokeWidth="1.5" />
    </svg>
  );
}

function Presets() {
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const showToast = useAppStore((s) => s.showToast);

  const refresh = () => {
    const db = getDB();
    if (!db) return;
    db.listPresets()
      .then((all) => setUserPresets(all.filter((p) => !p.id.startsWith('factory-'))))
      .catch(() => { /* IndexedDB unavailable */ });
  };
  useEffect(refresh, []);

  const load = (preset: Preset) => {
    applyPresetToStore(preset);
    showToast(`Loaded “${preset.name}”`);
  };

  const save = async () => {
    const db = getDB();
    if (!db) {
      showToast('Saving presets is not available in this browser');
      return;
    }
    const name = window.prompt('Preset name', `My sound ${userPresets.length + 1}`)?.trim();
    if (!name) return;
    try {
      await db.savePreset(stateToPreset(`user-${Date.now()}`, name));
      showToast(`Saved “${name}”`);
      refresh();
    } catch {
      showToast('Could not save preset');
    }
  };

  const remove = async (preset: Preset) => {
    const db = getDB();
    if (!db || !window.confirm(`Delete “${preset.name}”?`)) return;
    await db.deletePreset(preset.id).catch(() => {});
    refresh();
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionLabelStyle(ACCENT)}>Presets</div>
      <div style={rowStyle}>
        {FACTORY_PRESETS.map((p) => (
          <button key={p.id} style={chipStyle(false, ACCENT)} onClick={() => load(p)}>{p.name}</button>
        ))}
        {userPresets.map((p) => (
          <span key={p.id} style={{ display: 'inline-flex' }}>
            <button style={{ ...chipStyle(false, ACCENT), color: CYBER.amber, borderRadius: '4px 0 0 4px' }} onClick={() => load(p)}>{p.name}</button>
            <button aria-label={`Delete ${p.name}`} style={{ ...chipStyle(false, ACCENT), minWidth: 26, padding: '6px 6px', borderRadius: '0 4px 4px 0', borderLeft: '1px solid #333' }} onClick={() => void remove(p)}>✕</button>
          </span>
        ))}
        <button data-testid="save-preset" style={{ ...chipStyle(false, ACCENT), border: '1px dashed ' + CYBER.amber, color: CYBER.amber }} onClick={() => void save()}>
          + SAVE CURRENT
        </button>
      </div>
    </div>
  );
}

export function YellowOverlay() {
  const synthMode = useAppStore((s) => s.synthMode);
  const setSynthMode = useAppStore((s) => s.setSynthMode);
  const waveform = useAppStore((s) => s.waveform);
  const setWaveform = useAppStore((s) => s.setWaveform);
  const fmPresetIndex = useAppStore((s) => s.fmPresetIndex);
  const setFmPresetIndex = useAppStore((s) => s.setFmPresetIndex);
  const sampleName = useAppStore((s) => s.sampleName);
  const setSampleName = useAppStore((s) => s.setSampleName);
  const micSampleAvailable = useAppStore((s) => s.micSampleAvailable);
  const effects = useAppStore((s) => s.effects);
  const setEffect = useAppStore((s) => s.setEffect);
  const adsr = useAppStore((s) => s.adsr);
  const setAdsr = useAppStore((s) => s.setAdsr);
  const reverbType = useAppStore((s) => s.reverbType);
  const setReverbType = useAppStore((s) => s.setReverbType);

  return (
    <div>
      <Presets />

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

      {synthMode === 'sample' && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle(ACCENT)}>Sample</div>
          <div style={rowStyle}>
            {BUILTIN_INSTRUMENTS.map((inst) => (
              <button key={inst.id} style={chipStyle(sampleName === inst.id, ACCENT)} onClick={() => setSampleName(inst.id)}>
                {inst.label}
              </button>
            ))}
            <button
              style={{ ...chipStyle(sampleName === 'mic', ACCENT), opacity: micSampleAvailable ? 1 : 0.5 }}
              onClick={() => micSampleAvailable ? setSampleName('mic') : useAppStore.getState().setPlayMode('micSample')}
              title={micSampleAvailable ? '' : 'Record one in MODE → MIC'}
            >
              {micSampleAvailable ? 'MY MIC' : 'MIC… (record)'}
            </button>
          </div>
        </div>
      )}

      {synthMode === 'noise' && (
        <div style={{ ...sectionStyle, fontSize: 12, color: '#aaa' }}>
          Filtered noise tuned to the chord — breathy pads and wind. Try it with SWELL + REVERB.
        </div>
      )}

      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={sectionLabelStyle(ACCENT)}>Envelope</div>
          <AdsrCurve {...adsr} />
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 6 }}>
          {(
            [
              { key: 'attack' as const, label: 'ATTACK', max: 2000, unit: 'ms' },
              { key: 'decay' as const, label: 'DECAY', max: 1000, unit: 'ms' },
              { key: 'sustain' as const, label: 'SUSTAIN', max: 1, unit: '' },
              { key: 'release' as const, label: 'RELEASE', max: 3000, unit: 'ms' },
            ]
          ).map((f) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, minWidth: 52, color: LABEL_COLOR }}>{f.label}</span>
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
              <span style={{ fontSize: 11, minWidth: 48, textAlign: 'right', color: '#ccc' }}>
                {f.key === 'sustain' ? adsr[f.key].toFixed(2) : `${Math.round(adsr[f.key])}${f.unit}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Voice</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {VOICE_CONTROLS.map(({ type, label }) => {
            const state = effects[type];
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setEffect(type, { enabled: !state.enabled })}
                  aria-label={`toggle ${label}`}
                  aria-pressed={state.enabled}
                  style={effectToggleStyle(state.enabled)}
                >
                  {state.enabled ? '● ' : '○ '}{label}
                </button>
                <input
                  type="range" style={{ ...sliderStyle, opacity: state.enabled ? 1 : 0.45 }}
                  min={0} max={1} step={0.01} value={state.value}
                  onChange={(e) => setEffect(type, { value: parseFloat(e.target.value), enabled: true })}
                  aria-label={`${label} value`}
                />
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, minWidth: 52, color: LABEL_COLOR }}>VOICES</span>
            {VOICE_LIMITS.map((n) => {
              const vc = effects.voiceCount;
              const active = vc.enabled ? Math.round(vc.value) === n : n === 6;
              return (
                <button
                  key={n}
                  style={{ ...chipStyle(active, ACCENT), minWidth: 28, padding: '4px 6px' }}
                  onClick={() => setEffect('voiceCount', n === 6 ? { enabled: false, value: 6 } : { enabled: true, value: n })}
                >
                  {n === 6 ? 'ALL' : n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Effects <span style={{ textTransform: 'none', fontWeight: 400, color: '#999' }}>— tap a name to switch it on/off</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {EFFECTS.map(({ type, label }) => {
            const state = effects[type];
            const isFilter = type === 'filter';
            const sliderValue = isFilter ? cutoffToSlider(state.value) : state.value;
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setEffect(type, { enabled: !state.enabled })}
                  aria-label={`toggle ${label}`}
                  aria-pressed={state.enabled}
                  style={effectToggleStyle(state.enabled)}
                >
                  {state.enabled ? '● ' : '○ '}{label}
                </button>
                <input
                  type="range"
                  style={{ ...sliderStyle, opacity: state.enabled ? 1 : 0.45 }}
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliderValue}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    // Moving a slider implies you want to hear it.
                    setEffect(type, { value: isFilter ? sliderToCutoff(v) : v, enabled: true });
                  }}
                  aria-label={`${label} value`}
                />
              </div>
            );
          })}
        </div>
        <div style={{ ...rowStyle, alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, minWidth: 52, color: LABEL_COLOR }}>SPACE</span>
          {(['room', 'hall', 'plate'] as const).map((t) => (
            <button key={t} data-testid={`reverb-${t}`} style={chipStyle(reverbType === t, ACCENT)} onClick={() => setReverbType(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <LatencySection />
      <MidiSection />
    </div>
  );
}
