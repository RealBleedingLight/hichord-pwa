// src/components/__tests__/LooperView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LooperView } from '@/components/LooperView';
import { useAppStore } from '@/store';

function resetStore() {
  useAppStore.setState({
    looperTracks: Array.from({ length: 6 }, (_, i) => ({ index: i, state: 'empty' as const, gain: 1.0 })),
    looperState: 'off',
    looperBars: 4,
    activeTrack: 0,
  });
}

describe('LooperView', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders 6 track strips', () => {
    render(<LooperView onRecordToggle={vi.fn()} onStop={vi.fn()} onPlayToggle={vi.fn()} />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`looper-track-${i}`)).toBeTruthy();
    }
  });

  it('shows track state labels', () => {
    useAppStore.setState((s) => ({
      looperTracks: s.looperTracks.map((t) => (t.index === 2 ? { ...t, state: 'recording' as const } : t)),
    }));
    render(<LooperView onRecordToggle={vi.fn()} onStop={vi.fn()} onPlayToggle={vi.fn()} />);
    expect(screen.getByTestId('looper-track-state-2').textContent).toBe('REC');
  });

  it('clicking a track strip sets it as the active track', () => {
    render(<LooperView onRecordToggle={vi.fn()} onStop={vi.fn()} onPlayToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId('looper-track-3'));
    expect(useAppStore.getState().activeTrack).toBe(3);
  });

  it('record button calls onRecordToggle with the active track', () => {
    useAppStore.setState({ activeTrack: 4 });
    const onRecordToggle = vi.fn();
    render(<LooperView onRecordToggle={onRecordToggle} onStop={vi.fn()} onPlayToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId('looper-record'));
    expect(onRecordToggle).toHaveBeenCalledWith(4);
  });

  it('stop and play transport buttons fire callbacks', () => {
    const onStop = vi.fn();
    const onPlayToggle = vi.fn();
    render(<LooperView onRecordToggle={vi.fn()} onStop={onStop} onPlayToggle={onPlayToggle} />);
    fireEvent.click(screen.getByTestId('looper-stop'));
    fireEvent.click(screen.getByTestId('looper-play'));
    expect(onStop).toHaveBeenCalled();
    expect(onPlayToggle).toHaveBeenCalled();
  });

  it('bars selector updates the store', () => {
    render(<LooperView onRecordToggle={vi.fn()} onStop={vi.fn()} onPlayToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId('looper-bars-8'));
    expect(useAppStore.getState().looperBars).toBe(8);
  });

  it('mute toggle calls onTrackMuteToggle without changing active track', () => {
    const onTrackMuteToggle = vi.fn();
    render(<LooperView onRecordToggle={vi.fn()} onStop={vi.fn()} onPlayToggle={vi.fn()} onTrackMuteToggle={onTrackMuteToggle} />);
    fireEvent.click(screen.getByTestId('looper-track-mute-1'));
    expect(onTrackMuteToggle).toHaveBeenCalledWith(1);
    expect(useAppStore.getState().activeTrack).toBe(0);
  });
});
