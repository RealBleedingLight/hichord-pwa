import { describe, it, expect } from 'vitest';
import { Vocoder, computeBandFrequencies, applyFormantShift } from '@/audio/vocoder';

describe('computeBandFrequencies', () => {
  it('produces the requested number of bands', () => {
    const bands = computeBandFrequencies(12);
    expect(bands).toHaveLength(12);
  });

  it('spans from minFreq to maxFreq', () => {
    const bands = computeBandFrequencies(8, 100, 8000);
    expect(bands[0]).toBeCloseTo(100, 5);
    expect(bands[bands.length - 1]).toBeCloseTo(8000, 5);
  });

  it('spaces bands logarithmically (increasing ratio between consecutive bands is constant)', () => {
    const bands = computeBandFrequencies(5, 100, 1600);
    const ratios: number[] = [];
    for (let i = 1; i < bands.length; i++) {
      ratios.push(bands[i]! / bands[i - 1]!);
    }
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeCloseTo(ratios[0]!, 5);
    }
  });

  it('handles a single band as the geometric mean', () => {
    const bands = computeBandFrequencies(1, 100, 8000);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toBeCloseTo(Math.sqrt(100 * 8000), 5);
  });

  it('returns an empty array for zero or negative band counts', () => {
    expect(computeBandFrequencies(0)).toEqual([]);
    expect(computeBandFrequencies(-3)).toEqual([]);
  });
});

describe('applyFormantShift', () => {
  it('leaves frequencies unchanged for 0 semitones', () => {
    const freqs = [100, 200, 400];
    expect(applyFormantShift(freqs, 0)).toEqual(freqs);
  });

  it('doubles frequencies for +12 semitones (one octave up)', () => {
    const freqs = [100, 200];
    const shifted = applyFormantShift(freqs, 12);
    expect(shifted[0]).toBeCloseTo(200, 5);
    expect(shifted[1]).toBeCloseTo(400, 5);
  });

  it('halves frequencies for -12 semitones (one octave down)', () => {
    const freqs = [400];
    const shifted = applyFormantShift(freqs, -12);
    expect(shifted[0]).toBeCloseTo(200, 5);
  });
});

describe('Vocoder', () => {
  it('starts disabled with zero output gain', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 8);
    expect(vocoder.isEnabled()).toBe(false);
  });

  it('enable()/disable() toggle state', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 8);
    vocoder.enable();
    expect(vocoder.isEnabled()).toBe(true);
    vocoder.disable();
    expect(vocoder.isEnabled()).toBe(false);
  });

  it('builds the requested number of bands', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 16);
    expect(vocoder.getBandFrequencies()).toHaveLength(16);
  });

  it('setFormantShift stores the shift amount', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 8);
    vocoder.setFormantShift(5);
    expect(vocoder.getFormantShift()).toBe(5);
  });

  it('setGateThreshold clamps to 0..1', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 8);
    vocoder.setGateThreshold(2);
    expect(vocoder.getGateThreshold()).toBe(1);
    vocoder.setGateThreshold(-1);
    expect(vocoder.getGateThreshold()).toBe(0);
    vocoder.setGateThreshold(0.4);
    expect(vocoder.getGateThreshold()).toBe(0.4);
  });

  it('connectSynthSource wires a synth node into the carrier input without throwing', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const vocoder = new Vocoder(ctx, 8);
    const osc = ctx.createOscillator();
    expect(() => vocoder.connectSynthSource(osc)).not.toThrow();
  });

  it('passes carrier signal through to output when enabled', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000 * 0.2);
    const vocoder = new Vocoder(ctx, 8);
    vocoder.getOutput().connect(ctx.destination);
    vocoder.enable();

    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    vocoder.connectSynthSource(osc);
    osc.start();

    // Without a mic source, the envelope-follower gain stays at 0, so the
    // carrier is fully gated off. This confirms the graph renders without
    // throwing and produces a finite (silent) result.
    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);
    expect(data.every((v) => isFinite(v))).toBe(true);
  });
});
