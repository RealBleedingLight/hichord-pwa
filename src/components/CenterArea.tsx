// src/components/CenterArea.tsx
import { useAppStore } from '@/store';
import { DrumView, type DrumViewProps } from './DrumView';
import { LooperView, type LooperViewProps } from './LooperView';
import { SequencerGrid, type SequencerGridProps } from './SequencerGrid';
import { Tuner } from './Tuner';
import { MicSampleView } from './MicSampleView';
import { ChordHiro } from './ChordHiro';
import { EarTrainer } from './EarTrainer';
import { ChordDisplay } from './ChordDisplay';
import { VocoderView } from './VocoderView';
import type { ChordVoicing } from '@/music/types';

export interface CenterAreaProps {
  drumViewProps: DrumViewProps;
  looperViewProps: LooperViewProps;
  sequencerGridProps: SequencerGridProps;
  onChordTrigger?: (voicing: ChordVoicing) => void;
  onSampleCaptured?: (buffer: AudioBuffer, pitchHz: number | null) => void;
  /** The engine's AudioContext, so mic tools don't spin up their own. */
  getAudioContext?: () => AudioContext | null;
}

export function CenterArea({ drumViewProps, looperViewProps, sequencerGridProps, onChordTrigger, onSampleCaptured, getAudioContext }: CenterAreaProps) {
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
    return <Tuner getAudioContext={getAudioContext} />;
  }

  if (mode === 'micSample') {
    return <MicSampleView onSampleCaptured={onSampleCaptured} getAudioContext={getAudioContext} />;
  }

  if (mode === 'vocoder') {
    return <VocoderView />;
  }

  if (mode === 'chordHiro') {
    return <ChordHiro onChordTrigger={onChordTrigger} />;
  }

  if (mode === 'earTrainer') {
    return <EarTrainer onChordTrigger={onChordTrigger} />;
  }

  return <ChordDisplay />;
}
