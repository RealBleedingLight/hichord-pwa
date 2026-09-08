import { describe, it, expect } from 'vitest';
import { calculateLoopLength } from '@/audio/looper';

describe('Looper', () => {
  it('calculates loop length in samples for 4 bars at 120 BPM', () => {
    const samples = calculateLoopLength(4, 120, 48000);
    // 4 bars * 4 beats/bar * 0.5s/beat * 48000 samples/s = 384000
    expect(samples).toBe(384000);
  });

  it('calculates loop length for 1 bar at 90 BPM', () => {
    const samples = calculateLoopLength(1, 90, 48000);
    // 1 * 4 * (60/90) * 48000 = 128000
    expect(samples).toBe(128000);
  });

  it('returns integer sample count (no fractional)', () => {
    const samples = calculateLoopLength(3, 137, 48000);
    expect(Number.isInteger(samples)).toBe(true);
  });
});
