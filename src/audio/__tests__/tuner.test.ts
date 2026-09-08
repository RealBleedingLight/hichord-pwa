import { describe, it, expect, vi } from 'vitest';
import { Tuner } from '@/audio/tuner';

function makeSine(freq: number, sampleRate: number, durationSec: number): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = 0.8 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buffer;
}

describe('Tuner.processBuffer', () => {
  it('invokes onPitchDetected callbacks with note + cents for a clear tone', () => {
    const ctx = new OfflineAudioContext(1, 48000, 44100);
    const tuner = new Tuner(ctx as unknown as AudioContext);

    const cb = vi.fn();
    tuner.onPitchDetected(cb);

    const buffer = makeSine(440, 44100, 0.05);
    tuner.processBuffer(buffer);

    expect(cb).toHaveBeenCalledTimes(1);
    const [note, cents] = cb.mock.calls[0]!;
    expect(note).toBe('A4');
    expect(Math.abs(cents)).toBeLessThan(10);
  });

  it('does not invoke callbacks for silence', () => {
    const ctx = new OfflineAudioContext(1, 48000, 44100);
    const tuner = new Tuner(ctx as unknown as AudioContext);
    const cb = vi.fn();
    tuner.onPitchDetected(cb);

    tuner.processBuffer(new Float32Array(2048));
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple registered callbacks', () => {
    const ctx = new OfflineAudioContext(1, 48000, 44100);
    const tuner = new Tuner(ctx as unknown as AudioContext);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    tuner.onPitchDetected(cb1);
    tuner.onPitchDetected(cb2);

    tuner.processBuffer(makeSine(220, 44100, 0.05));
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('is not running before start() is called', () => {
    const ctx = new OfflineAudioContext(1, 48000, 44100);
    const tuner = new Tuner(ctx as unknown as AudioContext);
    expect(tuner.isRunning()).toBe(false);
  });

  it('stop() is safe to call when never started', () => {
    const ctx = new OfflineAudioContext(1, 48000, 44100);
    const tuner = new Tuner(ctx as unknown as AudioContext);
    expect(() => tuner.stop()).not.toThrow();
  });
});
