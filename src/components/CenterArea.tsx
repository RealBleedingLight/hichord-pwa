// src/components/CenterArea.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';
import { DrumView, type DrumViewProps } from './DrumView';
import { LooperView, type LooperViewProps } from './LooperView';
import { SequencerGrid, type SequencerGridProps } from './SequencerGrid';
import { Tuner } from './Tuner';
import { MicSampleView } from './MicSampleView';
import { ChordHiro } from './ChordHiro';
import { EarTrainer } from './EarTrainer';
import type { ChordVoicing } from '@/music/types';

export interface CenterAreaProps {
  drumViewProps: DrumViewProps;
  looperViewProps: LooperViewProps;
  sequencerGridProps: SequencerGridProps;
  onChordTrigger?: (voicing: ChordVoicing) => void;
}

export function CenterArea({ drumViewProps, looperViewProps, sequencerGridProps, onChordTrigger }: CenterAreaProps) {
  const mode = useAppStore((s) => s.playMode);
  const synthMode = useAppStore((s) => s.synthMode);

  if (mode === 'drum' || mode === 'drumLoops' || mode === 'autoDrum') {
    return <DrumView {...drumViewProps} />;
  }

  if (mode === 'mixer') {
    return <LooperView {...looperViewProps} />;
  }

  if (mode === 'sequencer') {
    return <SequencerGrid {...sequencerGridProps} />;
  }

  if (mode === 'tuner') {
    return <Tuner />;
  }

  if (mode === 'micSample') {
    return <MicSampleView />;
  }

  if (mode === 'chordHiro') {
    return <ChordHiro onChordTrigger={onChordTrigger} />;
  }

  if (mode === 'earTrainer') {
    return <EarTrainer onChordTrigger={onChordTrigger} />;
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8,
      background: CYBER.panel,
      border: '1px solid ' + CYBER.border,
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{
        fontFamily: CYBER.fontDisplay,
        fontSize: 32, fontWeight: 900,
        color: CYBER.textLight,
        textShadow: '0 0 20px ' + CYBER.secondaryGlow,
        letterSpacing: 4,
      }}>—</div>

      <div style={{
        width: '100%', height: 44,
        background: CYBER.bg,
        border: '1px solid ' + CYBER.border,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <svg viewBox="0 0 200 44" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <polyline
            points="0,22 10,18 20,26 30,14 40,30 50,10 60,34 70,8 80,36 90,12 100,28 110,16 120,26 130,20 140,22 150,20 160,21 170,22 180,21 190,22 200,22"
            fill="none" stroke={CYBER.primary} strokeWidth="2" opacity="0.4"
          />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 9, letterSpacing: 2 }}>
        {(['analog', 'fm', 'sample', 'noise'] as const).map((m) => (
          <span key={m} style={{
            color: synthMode === m ? CYBER.primary : '#333',
            textShadow: synthMode === m ? '0 0 8px ' + CYBER.primaryGlow : 'none',
            textTransform: 'uppercase',
          }}>{m === 'analog' ? 'ANALOG' : m.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}
