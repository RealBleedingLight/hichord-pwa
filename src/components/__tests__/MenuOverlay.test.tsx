// src/components/__tests__/MenuOverlay.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuOverlay } from '@/components/MenuOverlay';
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';
import { FM_PRESETS, ADSR_PRESETS } from '@/audio/types';

function resetStore() {
  useAppStore.setState({
    activeOverlay: null,
    key: 'C',
    scale: 'major',
    globalOctave: 0,
    buttonOctaves: [0, 0, 0, 0, 0, 0, 0],
    synthMode: 'analog',
    waveform: 'sawtooth',
    fmPresetIndex: 0,
    bassMode: 'off',
    voiceLeading: false,
    joystickMode: 'default',
    playMode: 'play',
    bpm: 120,
    strumSpeed: 'medium',
    arpPattern: 'up',
    arpRate: '1/8',
    arpChordMode: 'arpOnly',
    drumKit: 'tight',
  });
}

describe('MenuOverlay', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders nothing when activeOverlay is null', () => {
    const { container } = render(<MenuOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders GrayOverlay content when activeOverlay is gray', () => {
    useAppStore.setState({ activeOverlay: 'gray' });
    render(<MenuOverlay />);
    for (const key of ALL_KEYS) {
      expect(screen.getByText(key)).toBeTruthy();
    }
  });

  it('renders YellowOverlay content when activeOverlay is yellow', () => {
    useAppStore.setState({ activeOverlay: 'yellow', synthMode: 'fm' });
    render(<MenuOverlay />);
    expect(screen.getByText('ANALOG')).toBeTruthy();
    expect(screen.getByText(FM_PRESETS[0]!.name)).toBeTruthy();
    expect(screen.getByText('REVERB')).toBeTruthy();
  });

  it('renders RedOverlay content when activeOverlay is red', () => {
    useAppStore.setState({ activeOverlay: 'red' });
    render(<MenuOverlay />);
    expect(screen.getByText('STRUM')).toBeTruthy();
    expect(screen.getByText('TAP')).toBeTruthy();
  });

  it('closes overlay when backdrop is clicked', () => {
    useAppStore.setState({ activeOverlay: 'gray' });
    render(<MenuOverlay />);
    const backdrop = screen.getByTestId('overlay-backdrop');
    fireEvent.pointerDown(backdrop);
    expect(useAppStore.getState().activeOverlay).toBeNull();
  });

  it('clicking a key in GrayOverlay updates the store', () => {
    useAppStore.setState({ activeOverlay: 'gray' });
    render(<MenuOverlay />);
    fireEvent.click(screen.getByText('G'));
    expect(useAppStore.getState().key).toBe('G');
  });

  it('clicking ADSR preset in YellowOverlay updates the store adsr', () => {
    useAppStore.setState({ activeOverlay: 'yellow' });
    render(<MenuOverlay />);
    fireEvent.click(screen.getByText('PLUCK'));
    expect(useAppStore.getState().adsr).toEqual(ADSR_PRESETS.PLUCK);
  });

  it('clicking a play mode in RedOverlay updates the store', () => {
    useAppStore.setState({ activeOverlay: 'red' });
    render(<MenuOverlay />);
    fireEvent.click(screen.getByText('ARPEGGIO'));
    expect(useAppStore.getState().playMode).toBe('arpeggio');
  });

  it('BPM slider input updates the store bpm', () => {
    useAppStore.setState({ activeOverlay: 'red' });
    render(<MenuOverlay />);
    const slider = screen.getByTestId('bpm-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '160' } });
    expect(useAppStore.getState().bpm).toBe(160);
  });
});
