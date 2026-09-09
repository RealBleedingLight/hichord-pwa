import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChordHiro } from '@/components/ChordHiro';
import { useAppStore } from '@/store';

describe('ChordHiro', () => {
  beforeEach(() => {
    useAppStore.setState({ key: 'C', scale: 'major' });
  });

  it('renders with start button in idle state', () => {
    render(<ChordHiro />);
    expect(screen.getByTestId('chord-hiro')).toBeTruthy();
    expect(screen.getByTestId('chord-hiro-start')).toBeTruthy();
    expect(screen.getByText('START')).toBeTruthy();
  });

  it('starts game when start button clicked', () => {
    render(<ChordHiro />);
    fireEvent.click(screen.getByTestId('chord-hiro-start'));
    expect(screen.getByTestId('chord-hiro-score')).toBeTruthy();
    expect(screen.getByTestId('chord-hiro-lane')).toBeTruthy();
  });

  it('renders 7 key buttons during gameplay', () => {
    render(<ChordHiro />);
    fireEvent.click(screen.getByTestId('chord-hiro-start'));
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByTestId(`chord-hiro-key-${i}`)).toBeTruthy();
    }
  });

  it('key buttons are clickable during gameplay without error', () => {
    render(<ChordHiro />);
    fireEvent.click(screen.getByTestId('chord-hiro-start'));
    fireEvent.click(screen.getByTestId('chord-hiro-key-1'));
    expect(screen.getByTestId('chord-hiro-score')).toBeTruthy();
  });

  it('displays score, streak, and misses', () => {
    render(<ChordHiro />);
    fireEvent.click(screen.getByTestId('chord-hiro-start'));
    expect(screen.getByTestId('chord-hiro-score').textContent).toContain('Score');
    expect(screen.getByTestId('chord-hiro-streak').textContent).toContain('Streak');
    expect(screen.getByTestId('chord-hiro-misses').textContent).toContain('Misses');
  });
});
