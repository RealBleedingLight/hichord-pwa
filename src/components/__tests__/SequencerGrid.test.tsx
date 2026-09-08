// src/components/__tests__/SequencerGrid.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SequencerGrid } from '@/components/SequencerGrid';
import { Sequencer } from '@/audio/sequencer';

describe('SequencerGrid', () => {
  it('renders 16 step cells', () => {
    const sequencer = new Sequencer();
    render(<SequencerGrid sequencer={sequencer} />);
    for (let i = 0; i < 16; i++) {
      expect(screen.getByTestId(`sequencer-step-${i}`)).toBeTruthy();
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

  it('displays the degree number for a set step', () => {
    const sequencer = new Sequencer();
    sequencer.setStep(3, 5, 'up');
    render(<SequencerGrid sequencer={sequencer} />);
    expect(screen.getByTestId('sequencer-step-3').textContent).toContain('5');
  });

  it('calls onStepsChange after editing a step', () => {
    const sequencer = new Sequencer();
    const onStepsChange = vi.fn();
    render(<SequencerGrid sequencer={sequencer} onStepsChange={onStepsChange} />);
    fireEvent.click(screen.getByTestId('sequencer-step-5'));
    expect(onStepsChange).toHaveBeenCalled();
  });

  it('highlights the current step position', () => {
    const sequencer = new Sequencer();
    render(<SequencerGrid sequencer={sequencer} currentStep={2} />);
    const cell = screen.getByTestId('sequencer-step-2');
    expect(cell.style.border).toContain('2px solid');
  });
});
