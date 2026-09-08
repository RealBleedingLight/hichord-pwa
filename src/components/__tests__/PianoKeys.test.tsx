// src/components/__tests__/PianoKeys.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PianoKeys } from '@/components/PianoKeys';

describe('PianoKeys', () => {
  it('renders 7 chord labels', () => {
    const labels = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    render(
      <PianoKeys
        onKeyDown={vi.fn()}
        onKeyUp={vi.fn()}
        activeKeys={new Set()}
        labels={labels}
      />
    );
    for (const label of labels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
