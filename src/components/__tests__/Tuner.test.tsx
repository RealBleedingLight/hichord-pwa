// src/components/__tests__/Tuner.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Tuner } from '@/components/Tuner';

describe('Tuner', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders initial idle state', () => {
    render(<Tuner />);
    expect(screen.getByTestId('tuner-note').textContent).toBe('--');
    expect(screen.getByTestId('tuner-cents').textContent).toBe('Not listening');
    expect(screen.getByTestId('tuner-toggle').textContent).toBe('START TUNER');
  });

  it('shows an error message when microphone access is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    render(<Tuner />);
    fireEvent.click(screen.getByTestId('tuner-toggle'));

    await waitFor(() => {
      expect(screen.getByText('Microphone access denied')).toBeTruthy();
    });
    expect(screen.getByTestId('tuner-toggle').textContent).toBe('START TUNER');
  });
});
