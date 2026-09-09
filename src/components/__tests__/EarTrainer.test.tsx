import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EarTrainer } from '@/components/EarTrainer';
import { useAppStore } from '@/store';

describe('EarTrainer', () => {
  beforeEach(() => {
    useAppStore.setState({ key: 'C', scale: 'major' });
  });

  it('renders with level selection and start button', () => {
    render(<EarTrainer />);
    expect(screen.getByTestId('ear-trainer')).toBeTruthy();
    expect(screen.getByTestId('ear-trainer-start')).toBeTruthy();
    expect(screen.getByTestId('ear-trainer-level-1')).toBeTruthy();
    expect(screen.getByTestId('ear-trainer-level-2')).toBeTruthy();
    expect(screen.getByTestId('ear-trainer-level-3')).toBeTruthy();
    expect(screen.getByTestId('ear-trainer-level-4')).toBeTruthy();
  });

  it('starts a round when start is clicked', () => {
    const trigger = vi.fn();
    render(<EarTrainer onChordTrigger={trigger} />);
    fireEvent.click(screen.getByTestId('ear-trainer-start'));
    expect(trigger).toHaveBeenCalled();
    expect(screen.getByTestId('ear-trainer-play')).toBeTruthy();
  });

  it('shows options after starting', () => {
    render(<EarTrainer />);
    fireEvent.click(screen.getByTestId('ear-trainer-start'));
    const options = screen.getAllByTestId(/^ear-trainer-option-/);
    expect(options.length).toBeGreaterThan(0);
  });

  it('shows feedback after selecting an option', () => {
    render(<EarTrainer />);
    fireEvent.click(screen.getByTestId('ear-trainer-start'));
    const options = screen.getAllByTestId(/^ear-trainer-option-/);
    fireEvent.click(options[0]!);
    expect(screen.getByTestId('ear-trainer-feedback')).toBeTruthy();
  });

  it('shows next button after answering', () => {
    render(<EarTrainer />);
    fireEvent.click(screen.getByTestId('ear-trainer-start'));
    const options = screen.getAllByTestId(/^ear-trainer-option-/);
    fireEvent.click(options[0]!);
    expect(screen.getByTestId('ear-trainer-next')).toBeTruthy();
  });

  it('displays score', () => {
    render(<EarTrainer />);
    expect(screen.getByTestId('ear-trainer-score')).toBeTruthy();
  });

  it('allows changing difficulty level', () => {
    render(<EarTrainer />);
    fireEvent.click(screen.getByTestId('ear-trainer-level-2'));
    expect(screen.getByTestId('ear-trainer-level-2').style.background).not.toBe('#0f1626');
  });
});
