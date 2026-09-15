// src/components/__tests__/CenterArea.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CenterArea, type CenterAreaProps } from '@/components/CenterArea';
import { useAppStore } from '@/store';
import { Sequencer } from '@/audio/sequencer';

function baseProps(): CenterAreaProps {
  return {
    drumViewProps: { onTriggerDrum: vi.fn() },
    looperViewProps: { onRecordToggle: vi.fn(), onStop: vi.fn(), onPlayToggle: vi.fn() },
    sequencerGridProps: { sequencer: new Sequencer() },
  };
}

describe('CenterArea', () => {
  it('routes to DrumView for drum mode', () => {
    useAppStore.setState({ playMode: 'drum' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('drum-pad-kick')).toBeTruthy();
  });

  it('routes to DrumView for drumLoops mode', () => {
    useAppStore.setState({ playMode: 'drumLoops' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('drum-pad-kick')).toBeTruthy();
    expect(screen.getByTestId('genre-tab-Rock')).toBeTruthy();
  });

  it('routes to DrumView for autoDrum mode', () => {
    useAppStore.setState({ playMode: 'autoDrum' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('drum-pad-kick')).toBeTruthy();
  });

  it('routes to LooperView for mixer mode', () => {
    useAppStore.setState({
      playMode: 'mixer',
      looperTracks: Array.from({ length: 6 }, (_, i) => ({ index: i, state: 'empty' as const, gain: 1.0 })),
    });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('looper-track-0')).toBeTruthy();
  });

  it('routes to SequencerGrid for sequencer mode', () => {
    useAppStore.setState({ playMode: 'sequencer' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('sequencer-step-0')).toBeTruthy();
  });

  it('shows default waveform display for other modes', () => {
    useAppStore.setState({ playMode: 'play', synthMode: 'analog' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByText('ANALOG')).toBeTruthy();
  });

  it('routes to Tuner for tuner mode', () => {
    useAppStore.setState({ playMode: 'tuner' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('tuner-toggle')).toBeTruthy();
  });

  it('routes to MicSampleView for micSample mode', () => {
    useAppStore.setState({ playMode: 'micSample' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('mic-sample-record')).toBeTruthy();
  });

  it('routes to ChordHiro for chordHiro mode', () => {
    useAppStore.setState({ playMode: 'chordHiro' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('chord-hiro')).toBeTruthy();
  });

  it('routes to EarTrainer for earTrainer mode', () => {
    useAppStore.setState({ playMode: 'earTrainer' });
    render(<CenterArea {...baseProps()} />);
    expect(screen.getByTestId('ear-trainer')).toBeTruthy();
  });
});
