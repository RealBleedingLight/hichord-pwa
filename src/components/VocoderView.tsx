// src/components/VocoderView.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

/**
 * Vocoder mode: the mic shapes the synth. Hold chord keys (right) and sing or
 * talk — the chord "speaks" your words. Saw waves and sustained envelopes
 * give the clearest result.
 */
export function VocoderView() {
  const micOn = useAppStore((s) => s.vocoderMicOn);
  const formant = useAppStore((s) => s.vocoderFormant);
  const gate = useAppStore((s) => s.vocoderGate);
  const setVocoder = useAppStore((s) => s.setVocoder);
  const synthMode = useAppStore((s) => s.synthMode);
  const waveform = useAppStore((s) => s.waveform);
  const setSynthMode = useAppStore((s) => s.setSynthMode);
  const setWaveform = useAppStore((s) => s.setWaveform);
  const bestCarrier = synthMode === 'analog' && (waveform === 'sawtooth' || waveform === 'square');

  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '90px 1fr 60px', alignItems: 'center', gap: 8, width: '100%', maxWidth: 420 };

  return (
    <div data-testid="vocoder" style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 16, background: CYBER.panel, border: '1px solid ' + CYBER.border, borderRadius: 8,
    }}>
      <div style={{ fontFamily: CYBER.fontDisplay, fontSize: 22, fontWeight: 800, color: CYBER.textLight, letterSpacing: 2 }}>VOCODER</div>
      <div style={{ fontSize: 12, color: CYBER.textDim, textAlign: 'center', maxWidth: 380, lineHeight: 1.4 }}>
        Turn on the mic, <b style={{ color: CYBER.textLight }}>hold a chord key</b> and sing or talk. Headphones stop the speaker feeding back into the mic.
      </div>
      <button
        data-testid="vocoder-mic"
        onClick={() => setVocoder({ vocoderMicOn: !micOn })}
        style={{
          minWidth: 170, minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: micOn ? CYBER.primary : '#2a0a0a', color: '#fff', fontSize: 14, fontWeight: 700,
          boxShadow: micOn ? '0 0 14px ' + CYBER.primaryGlow : 'none',
        }}
      >
        {micOn ? '● MIC ON' : 'TURN MIC ON'}
      </button>
      <div style={row}>
        <span style={{ fontSize: 11, color: CYBER.textMid }}>FORMANT</span>
        <input type="range" min={-12} max={12} step={1} value={formant} aria-label="Formant shift"
          onChange={(e) => setVocoder({ vocoderFormant: parseInt(e.target.value, 10) })} style={{ touchAction: 'none' }} />
        <span style={{ fontSize: 12, color: CYBER.textLight, textAlign: 'right' }}>{formant > 0 ? '+' : ''}{formant} st</span>
      </div>
      <div style={row}>
        <span style={{ fontSize: 11, color: CYBER.textMid }}>NOISE GATE</span>
        <input type="range" min={0} max={0.2} step={0.005} value={gate} aria-label="Noise gate"
          onChange={(e) => setVocoder({ vocoderGate: parseFloat(e.target.value) })} style={{ touchAction: 'none' }} />
        <span style={{ fontSize: 12, color: CYBER.textLight, textAlign: 'right' }}>{Math.round(gate * 500)}%</span>
      </div>
      {!bestCarrier && (
        <button
          onClick={() => { setSynthMode('analog'); setWaveform('sawtooth'); }}
          style={{ fontSize: 11, color: CYBER.amber, background: 'none', border: '1px dashed ' + CYBER.amber, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}
        >
          Tip: a saw wave speaks clearest — switch to ANALOG · SAW
        </button>
      )}
    </div>
  );
}
