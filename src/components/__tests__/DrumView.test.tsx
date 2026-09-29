// src/components/__tests__/DrumView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrumView } from '@/components/DrumView';
import { useAppStore } from '@/store';
import { getPatternsForGenre } from '@/data/drum-patterns';

function resetStore() {
  useAppStore.setState({ playMode: 'drum', transportPlaying: false, transportStep: null });
  useAppStore.getState().selectBeat('Rock', 0);
}

describe('DrumView', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders all 16 drum pads', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    for (const sound of ['kick', 'snare', 'clap', 'rim', 'closedHH', 'openHH', 'tomHigh', 'tomLow',
      'perc', 'crash', 'ride', 'shaker', 'altKick', 'fx1', 'fx2', 'fx3']) {
      expect(screen.getByTestId(`drum-pad-${sound}`)).toBeTruthy();
    }
  });

  it('triggers a drum on pad press and reports hold state', () => {
    const onTriggerDrum = vi.fn();
    const onHoldChange = vi.fn();
    render(<DrumView onTriggerDrum={onTriggerDrum} onHoldChange={onHoldChange} />);
    const pad = screen.getByTestId('drum-pad-snare');
    fireEvent.pointerDown(pad);
    expect(onTriggerDrum).toHaveBeenCalledWith('snare');
    expect(onHoldChange).toHaveBeenLastCalledWith('snare', true);
    fireEvent.pointerUp(pad);
    expect(onHoldChange).toHaveBeenLastCalledWith('snare', false);
  });

  it('shows the selected beat in the step grid', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    const rock = getPatternsForGenre('Rock')[0]!;
    const kickStep = rock.hits.find((h) => h.sound === 'kick')!.step;
    expect(screen.getByTestId(`beat-cell-kick-${kickStep}`).getAttribute('aria-pressed')).toBe('true');
  });

  it('selecting a genre and variation loads that beat', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    fireEvent.click(screen.getByTestId('genre-tab-Funk'));
    fireEvent.click(screen.getByTestId('variation-Ghost'));
    const s = useAppStore.getState();
    expect(s.beatGenre).toBe('Funk');
    expect(s.beatHits).toEqual(getPatternsForGenre('Funk')[1]!.hits);
    expect(screen.getByTestId('current-pattern-name').textContent).toContain('Funk - Ghost');
  });

  it('editing a step marks the beat as edited', () => {
    render(<DrumView onTriggerDrum={vi.fn()} />);
    fireEvent.click(screen.getByTestId('beat-cell-clap-3'));
    const s = useAppStore.getState();
    expect(s.beatHits.some((h) => h.sound === 'clap' && h.step === 3)).toBe(true);
    expect(s.beatEdited).toBe(true);
    expect(screen.getByTestId('current-pattern-name').textContent).toContain('(edited)');
  });

  it('play button toggles the shared transport', () => {
    const onToggleTransport = vi.fn();
    render(<DrumView onTriggerDrum={vi.fn()} onToggleTransport={onToggleTransport} />);
    fireEvent.click(screen.getByTestId('drum-pattern-transport'));
    expect(onToggleTransport).toHaveBeenCalledTimes(1);
  });

  it('explains hold-to-repeat in autoDrum mode', () => {
    useAppStore.setState({ playMode: 'autoDrum' });
    render(<DrumView onTriggerDrum={vi.fn()} />);
    expect(screen.getByText(/HOLD A PAD/)).toBeTruthy();
  });
});
