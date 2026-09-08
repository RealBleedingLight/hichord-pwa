// src/components/__tests__/DrumView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrumView } from '@/components/DrumView';
import { useAppStore } from '@/store';

function resetStore() {
  useAppStore.setState({ playMode: 'drum' });
}

describe('DrumView', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders all 7 drum pads', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    expect(screen.getByTestId('drum-pad-kick')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-altKick')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-snare')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-closedHH')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-openHH')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-tom')).toBeTruthy();
    expect(screen.getByTestId('drum-pad-bellRide')).toBeTruthy();
  });

  it('calls onTriggerDrum when a pad is pressed', () => {
    const onTriggerDrum = vi.fn();
    render(<DrumView onTriggerDrum={onTriggerDrum} />);
    fireEvent.pointerDown(screen.getByTestId('drum-pad-kick'));
    expect(onTriggerDrum).toHaveBeenCalledWith('kick');
  });

  it('calls onHoldChange on pointer down/up', () => {
    const onHoldChange = vi.fn();
    render(<DrumView onTriggerDrum={vi.fn()} onHoldChange={onHoldChange} />);
    const pad = screen.getByTestId('drum-pad-snare');
    fireEvent.pointerDown(pad);
    expect(onHoldChange).toHaveBeenCalledWith('snare', true);
    fireEvent.pointerUp(pad);
    expect(onHoldChange).toHaveBeenCalledWith('snare', false);
  });

  it('does not show pattern browser in drum mode', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    expect(screen.queryByTestId('genre-tab-Rock')).toBeNull();
  });

  it('shows the pattern browser and instructions in autoDrum mode', () => {
    useAppStore.setState({ playMode: 'autoDrum' });
    render(<DrumView onTriggerDrum={vi.fn()} />);
    expect(screen.getByText(/hold pads/i)).toBeTruthy();
  });

  it('shows genre tabs and variations in drumLoops mode, calls onPatternChange', () => {
    useAppStore.setState({ playMode: 'drumLoops' });
    const onPatternChange = vi.fn();
    render(<DrumView onTriggerDrum={vi.fn()} onPatternChange={onPatternChange} />);
    expect(screen.getByTestId('genre-tab-Rock')).toBeTruthy();
    expect(screen.getByTestId('genre-tab-Funk')).toBeTruthy();
    expect(onPatternChange).toHaveBeenCalled();
    expect(screen.getByTestId('current-pattern-name').textContent).toContain('Rock');
  });

  it('switching genre resets variation and updates pattern list', () => {
    useAppStore.setState({ playMode: 'drumLoops' });
    render(<DrumView onTriggerDrum={vi.fn()} />);
    fireEvent.click(screen.getByTestId('genre-tab-Funk'));
    expect(screen.getByTestId('current-pattern-name').textContent).toContain('Funk');
  });

  it('toggles play/stop transport for drum patterns', () => {
    useAppStore.setState({ playMode: 'drumLoops' });
    const onTogglePlay = vi.fn();
    render(<DrumView onTriggerDrum={vi.fn()} onTogglePlay={onTogglePlay} isPlaying={false} />);
    fireEvent.click(screen.getByTestId('drum-pattern-transport'));
    expect(onTogglePlay).toHaveBeenCalled();
  });
});
