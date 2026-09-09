// src/components/CenterArea.tsx
import { useAppStore } from '@/store';
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
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#445',
      fontSize: 14,
    }}>
      <span style={{ opacity: 0.5 }}>{mode} mode</span>
    </div>
  );
}
