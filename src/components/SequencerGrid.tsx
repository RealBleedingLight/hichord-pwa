import { useState } from 'react';
import type { Sequencer } from '@/audio/sequencer';
import type { ScaleDegree } from '@/music/types';
import { CYBER } from '@/theme';

const DEGREE_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

const TRACK_COLORS = [
  { name: 'CHORDS', color: CYBER.secondary, glow: CYBER.secondaryGlow, height: 44 },
  { name: 'MELODY', color: CYBER.secondary, glow: CYBER.secondaryGlow, height: 38 },
  { name: 'BASS', color: CYBER.primary, glow: CYBER.primaryGlow, height: 38 },
  { name: 'DRUMS', color: CYBER.amber, glow: CYBER.amberGlow, height: 38 },
] as const;

const BAR_COLORS = [
  { bg: 'linear-gradient(135deg, #00344a, #002233)', border: CYBER.secondary, glow: CYBER.secondaryGlow },
  { bg: 'linear-gradient(135deg, #1a0808, #120000)', border: CYBER.primary, glow: CYBER.primaryGlow },
  { bg: 'linear-gradient(135deg, #1a1500, #120e00)', border: CYBER.amber, glow: CYBER.amberGlow },
  { bg: 'linear-gradient(135deg, #0a1a0a, #051005)', border: '#4caf50', glow: 'rgba(76,175,80,.12)' },
] as const;

export interface SequencerGridProps {
  sequencer: Sequencer;
  currentStep?: number | null;
  onStepsChange?: () => void;
}

export function SequencerGrid({ sequencer, currentStep = null, onStepsChange }: SequencerGridProps) {
  const [, forceRender] = useState(0);
  const [auxTracks, setAuxTracks] = useState<boolean[][]>(() =>
    Array.from({ length: 3 }, () => Array.from({ length: 16 }, () => false))
  );
  const steps = sequencer.getSteps();

  const handleChordTap = (index: number) => {
    const step = sequencer.getStep(index);
    if (!step) {
      sequencer.setStep(index, 1, 'center');
    } else if (step.degree < 7) {
      sequencer.setStep(index, (step.degree + 1) as ScaleDegree, step.direction, step.durationSteps);
    } else {
      sequencer.removeStep(index);
    }
    forceRender((n) => n + 1);
    onStepsChange?.();
  };

  const toggleAux = (trackIdx: number, stepIdx: number) => {
    setAuxTracks((prev) => {
      const next = prev.map((row) => [...row]);
      const track = next[trackIdx];
      if (track) {
        track[stepIdx] = !track[stepIdx];
      }
      return next;
    });
  };

  const gridCols = '60px repeat(16, 1fr)';

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 3, padding: 6, overflow: 'hidden',
      fontFamily: CYBER.fontMono,
    }}>
      {/* Bar labels */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2, height: 14 }}>
        <div />
        {[1, 2, 3, 4].map((bar) => (
          <div key={bar} style={{
            gridColumn: 'span 4',
            textAlign: 'center',
            fontSize: 8,
            color: CYBER.textDim,
            borderBottom: '1px solid #220000',
          }}>BAR {bar}</div>
        ))}
      </div>

      {/* CHORDS track */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2, height: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 8, color: CYBER.textMid }}>CHORDS</div>
        {Array.from({ length: 4 }, (_, barIdx) => {
          const startStep = barIdx * 4;
          const step = steps[startStep];
          const degree = step?.degree;
          const chordLabel = degree != null ? DEGREE_NAMES[degree - 1] ?? '?' : '—';
          const colors = BAR_COLORS[barIdx % BAR_COLORS.length]!;
          return (
            <button
              key={barIdx}
              data-testid={`sequencer-step-${startStep}`}
              onClick={() => handleChordTap(startStep)}
              style={{
                gridColumn: 'span 4',
                background: degree != null ? colors.bg : '#1a0808',
                border: degree != null ? `1px solid ${colors.border}` : '1px solid ' + CYBER.border,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: degree != null ? `0 0 10px ${colors.glow}` : 'none',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              <span style={{
                fontFamily: CYBER.fontDisplay,
                fontSize: 14,
                fontWeight: 700,
                color: degree != null ? colors.border : CYBER.textDim,
              }}>{chordLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Auxiliary tracks: MELODY, BASS, DRUMS */}
      {TRACK_COLORS.slice(1).map((track, trackIdx) => {
        const auxRow = auxTracks[trackIdx];
        return (
          <div key={track.name} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2, height: 38 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 8, color: CYBER.textMid }}>{track.name}</div>
            {Array.from({ length: 16 }, (_, stepIdx) => {
              const active = auxRow?.[stepIdx] ?? false;
              return (
                <button
                  key={stepIdx}
                  onClick={() => toggleAux(trackIdx, stepIdx)}
                  style={{
                    background: active ? track.color : CYBER.bg,
                    borderRadius: 3,
                    border: 'none',
                    opacity: active ? 0.7 : 1,
                    boxShadow: active ? `0 0 4px ${track.glow}` : 'none',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* Playhead */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 2, height: 8 }}>
        <div />
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{
            background: currentStep === i ? CYBER.primary : '#220000',
            borderRadius: 2,
            boxShadow: currentStep === i ? `0 0 8px ${CYBER.primaryGlow}` : 'none',
          }} />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <button style={{
            padding: '3px 8px', borderRadius: 3,
            background: CYBER.secondary, color: '#000',
            fontSize: 8, fontWeight: 700, border: 'none',
            cursor: 'pointer', touchAction: 'manipulation',
          }}>LOOP</button>
          <button style={{
            padding: '3px 8px', borderRadius: 3,
            background: '#1a0808', color: CYBER.textDim,
            fontSize: 8, border: '1px solid ' + CYBER.border,
            cursor: 'pointer', touchAction: 'manipulation',
          }}>ONCE</button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 3 }}>
          {['+ TRACK', 'QUANTIZE', 'EXPORT'].map((label) => (
            <button key={label} style={{
              padding: '3px 8px', borderRadius: 3,
              background: '#1a0808', color: CYBER.textDim,
              fontSize: 8, border: '1px solid ' + CYBER.border,
              cursor: 'pointer', touchAction: 'manipulation',
            }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
