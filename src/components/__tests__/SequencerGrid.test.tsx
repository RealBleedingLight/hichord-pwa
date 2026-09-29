// src/components/__tests__/SequencerGrid.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SequencerGrid } from '@/components/SequencerGrid';
import { useAppStore, SEQUENCE_SLOTS } from '@/store';

describe('SequencerGrid', () => {
  beforeEach(() => {
    useAppStore.setState({
      key: 'C',
      scale: 'major',
      joystickMode: 'default',
      chordLocks: [],
      sequence: Array.from({ length: SEQUENCE_SLOTS }, () => null),
      selectedSlot: null,
      transportPlaying: false,
      transportStep: null,
    });
  });

  it('renders one cell per slot', () => {
    render(<SequencerGrid />);
    for (let i = 0; i < SEQUENCE_SLOTS; i++) {
      expect(screen.getByTestId(`sequencer-step-${i}`)).toBeTruthy();
    }
  });

  it('tapping a slot selects it for chord entry, tapping again deselects', () => {
    render(<SequencerGrid />);
    fireEvent.click(screen.getByTestId('sequencer-step-2'));
    expect(useAppStore.getState().selectedSlot).toBe(2);
    fireEvent.click(screen.getByTestId('sequencer-step-2'));
    expect(useAppStore.getState().selectedSlot).toBeNull();
  });

  it('shows the chord name for filled slots, including pad modifiers', () => {
    useAppStore.getState().setSequenceSlot(0, { degree: 6, direction: 'center' });
    useAppStore.getState().setSequenceSlot(1, { degree: 5, direction: 'upRight' });
    render(<SequencerGrid />);
    expect(screen.getByTestId('sequencer-step-0').textContent).toContain('Am');
    expect(screen.getByTestId('sequencer-step-1').textContent).toContain('G7');
  });

  it('clear removes the progression', () => {
    useAppStore.getState().setSequenceSlot(0, { degree: 1, direction: 'center' });
    render(<SequencerGrid />);
    fireEvent.click(screen.getByTestId('sequencer-clear'));
    expect(useAppStore.getState().sequence.every((s) => s === null)).toBe(true);
  });

  it('the per-slot ✕ clears just that slot', () => {
    useAppStore.getState().setSequenceSlot(3, { degree: 4, direction: 'center' });
    render(<SequencerGrid />);
    fireEvent.click(screen.getByLabelText('Clear slot 4'));
    expect(useAppStore.getState().sequence[3]).toBeNull();
  });

  it('play toggles the shared transport', () => {
    const onToggleTransport = vi.fn();
    render(<SequencerGrid onToggleTransport={onToggleTransport} />);
    fireEvent.click(screen.getByTestId('sequencer-play'));
    expect(onToggleTransport).toHaveBeenCalledTimes(1);
  });
});
