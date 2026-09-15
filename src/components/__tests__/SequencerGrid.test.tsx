import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SequencerGrid } from '@/components/SequencerGrid';
import { Sequencer } from '@/audio/sequencer';

describe('SequencerGrid', () => {
  it('renders 4 chord bar cells', () => {
    const sequencer = new Sequencer();
    render(<SequencerGrid sequencer={sequencer} />);
    for (const step of [0, 4, 8, 12]) {
      expect(screen.getByTestId(`sequencer-step-${step}`)).toBeTruthy();
    }
  });

  it('tapping an empty cell sets a step on the sequencer', () => {
    const sequencer = new Sequencer();
    render(<SequencerGrid sequencer={sequencer} />);
    fireEvent.click(screen.getByTestId('sequencer-step-0'));
    expect(sequencer.getStep(0)).toEqual({ degree: 1, direction: 'center', durationSteps: 1 });
  });

  it('tapping a filled cell cycles the degree, and clears after degree 7', () => {
    const sequencer = new Sequencer();
    sequencer.setStep(0, 7, 'center');
    render(<SequencerGrid sequencer={sequencer} />);
    fireEvent.click(screen.getByTestId('sequencer-step-0'));
    expect(sequencer.getStep(0)).toBeNull();
  });

  it('displays the degree name for a set step', () => {
    const sequencer = new Sequencer();
    sequencer.setStep(4, 5, 'up');
    render(<SequencerGrid sequencer={sequencer} />);
    expect(screen.getByTestId('sequencer-step-4').textContent).toContain('V');
  });

  it('calls onStepsChange after editing a step', () => {
    const sequencer = new Sequencer();
    const onStepsChange = vi.fn();
    render(<SequencerGrid sequencer={sequencer} onStepsChange={onStepsChange} />);
    fireEvent.click(screen.getByTestId('sequencer-step-0'));
    expect(onStepsChange).toHaveBeenCalled();
  });

  it('renders track labels and playhead', () => {
    const sequencer = new Sequencer();
    render(<SequencerGrid sequencer={sequencer} currentStep={2} />);
    expect(screen.getByText('CHORDS')).toBeTruthy();
    expect(screen.getByText('MELODY')).toBeTruthy();
    expect(screen.getByText('BASS')).toBeTruthy();
    expect(screen.getByText('DRUMS')).toBeTruthy();
  });
});
