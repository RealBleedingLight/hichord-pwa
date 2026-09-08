// src/components/SequencerGrid.tsx
import { useState } from 'react';
import type { Sequencer } from '@/audio/sequencer';
import type { ScaleDegree } from '@/music/types';

const ACCENT = '#4a9eff';

const DIRECTION_ARROWS: Record<string, string> = {
  center: '',
  up: '↑',
  upRight: '↗',
  right: '→',
  downRight: '↘',
  down: '↓',
  downLeft: '↙',
  left: '←',
  upLeft: '↖',
};

export interface SequencerGridProps {
  sequencer: Sequencer;
  currentStep?: number | null;
  onStepsChange?: () => void;
}

export function SequencerGrid({ sequencer, currentStep = null, onStepsChange }: SequencerGridProps) {
  const [, forceRender] = useState(0);
  const steps = sequencer.getSteps();

  const handleTap = (index: number) => {
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxWidth: 280 }}>
        {steps.map((step, i) => (
          <button
            key={i}
            data-testid={`sequencer-step-${i}`}
            onClick={() => handleTap(i)}
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 6,
              border: currentStep === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              background: step ? '#2a3a5a' : '#0f1626',
              color: '#eee',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {step ? (
              <>
                <span>{step.degree}</span>
                <span style={{ fontSize: 10 }}>{DIRECTION_ARROWS[step.direction] ?? ''}</span>
              </>
            ) : (
              <span style={{ opacity: 0.3 }}>{i + 1}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
