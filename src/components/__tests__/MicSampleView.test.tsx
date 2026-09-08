// src/components/__tests__/MicSampleView.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MicSampleView } from '@/components/MicSampleView';

describe('MicSampleView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders initial idle state', () => {
    render(<MicSampleView />);
    expect(screen.getByTestId('mic-sample-status').textContent).toBe('Ready to record a sample');
    expect(screen.getByTestId('mic-sample-record').textContent).toBe('RECORD SAMPLE');
  });

  it('shows an error message when microphone access is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    render(<MicSampleView />);
    fireEvent.click(screen.getByTestId('mic-sample-record'));

    await waitFor(() => {
      expect(screen.getByText('Microphone access denied')).toBeTruthy();
    });
    expect(screen.getByTestId('mic-sample-record').textContent).toBe('RECORD SAMPLE');
  });
});
