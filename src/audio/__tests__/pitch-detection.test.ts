import { describe, it, expect } from 'vitest';
import { autocorrelate, frequencyToNote } from '@/audio/pitch-detection';

function makeSine(freq: number, sampleRate: number, durationSec: number, amplitude = 0.8): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buffer;
}

describe('autocorrelate', () => {
  it('detects the fundamental frequency of a 440Hz sine wave', () => {
    const buffer = makeSine(440, 44100, 0.05);
    const freq = autocorrelate(buffer, 44100);
    expect(freq).toBeGreaterThan(435);
    expect(freq).toBeLessThan(445);
  });

  it('detects a low frequency (110Hz)', () => {
    const buffer = makeSine(110, 44100, 0.1);
    const freq = autocorrelate(buffer, 44100);
    expect(freq).toBeGreaterThan(105);
    expect(freq).toBeLessThan(115);
  });

  it('detects a high frequency (1000Hz)', () => {
    const buffer = makeSine(1000, 44100, 0.03);
    const freq = autocorrelate(buffer, 44100);
    expect(freq).toBeGreaterThan(970);
    expect(freq).toBeLessThan(1030);
  });

  it('returns -1 for silence', () => {
    const buffer = new Float32Array(2048); // all zeros
    const freq = autocorrelate(buffer, 44100);
    expect(freq).toBe(-1);
  });

  it('returns -1 for a too-short buffer', () => {
    const buffer = new Float32Array(2);
    const freq = autocorrelate(buffer, 44100);
    expect(freq).toBe(-1);
  });
});

describe('frequencyToNote', () => {
  it('maps 440Hz exactly to A4 with 0 cents', () => {
    const { note, cents } = frequencyToNote(440);
    expect(note).toBe('A4');
    expect(cents).toBe(0);
  });

  it('maps 261.63Hz to C4', () => {
    const { note, cents } = frequencyToNote(261.63);
    expect(note).toBe('C4');
    expect(Math.abs(cents)).toBeLessThan(5);
  });

  it('maps 220Hz to A3', () => {
    const { note } = frequencyToNote(220);
    expect(note).toBe('A3');
  });

  it('reports positive cents when sharp of the nearest note', () => {
    // 445Hz is slightly sharp of A4 (440Hz)
    const { note, cents } = frequencyToNote(445);
    expect(note).toBe('A4');
    expect(cents).toBeGreaterThan(0);
  });

  it('reports negative cents when flat of the nearest note', () => {
    const { note, cents } = frequencyToNote(436);
    expect(note).toBe('A4');
    expect(cents).toBeLessThan(0);
  });

  it('returns a placeholder for invalid frequencies', () => {
    expect(frequencyToNote(0)).toEqual({ note: '--', cents: 0 });
    expect(frequencyToNote(-5)).toEqual({ note: '--', cents: 0 });
    expect(frequencyToNote(NaN)).toEqual({ note: '--', cents: 0 });
  });
});
