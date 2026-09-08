// src/components/CenterArea.tsx
import { useAppStore } from '@/store';
import { DrumView, type DrumViewProps } from './DrumView';
import { LooperView, type LooperViewProps } from './LooperView';
import { SequencerGrid, type SequencerGridProps } from './SequencerGrid';

export interface CenterAreaProps {
  drumViewProps: DrumViewProps;
  looperViewProps: LooperViewProps;
  sequencerGridProps: SequencerGridProps;
}

export function CenterArea({ drumViewProps, looperViewProps, sequencerGridProps }: CenterAreaProps) {
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
