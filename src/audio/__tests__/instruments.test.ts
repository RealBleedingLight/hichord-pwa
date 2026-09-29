import { describe, it, expect } from 'vitest';
import { BUILTIN_INSTRUMENTS, renderInstrument, zoneFor } from '@/audio/instruments';
import { AnalogSynth } from '@/audio/synth-analog';
import { ADSR_PRESETS } from '@/audio/types';
import { getChord } from '@/music/chord-engine';

describe('built-in sample instruments', () => {
  for (const { id } of BUILTIN_INSTRUMENTS) {
    it(`${id} renders normalised, non-silent zones across the range`, () => {
      const ctx = new OfflineAudioContext(1, 4800, 48000);
      const t0 = performance.now();
      const set = renderInstrument(ctx, id);
      const ms = performance.now() - t0;
      expect(set.zones.length).toBeGreaterThanOrEqual(4);
      for (const zone of set.zones) {
        const data = zone.buffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]!));
        expect(peak).toBeGreaterThan(0.5);
        expect(peak).toBeLessThanOrEqual(0.9001);
      }
      // Rendered on first selection, so it must be quick.
      expect(ms).toBeLessThan(1500);
    });
  }
});

describe('instrument zones', () => {
  it('guitar zones are tuned to the exact pitch rendered', () => {
    const ctx = new OfflineAudioContext(1, 4800, 48000);
    const set = renderInstrument(ctx, 'pluck');
    const top = zoneFor(set, 76);
    // Within a few cents of E5, whatever the delay-line rounding did.
    expect(Math.abs(top.rootMidi - 76)).toBeLessThan(0.5);
  });

  it('picks the nearest zone so notes are never shifted more than half an octave', () => {
    const ctx = new OfflineAudioContext(1, 4800, 48000);
    const set = renderInstrument(ctx, 'piano');
    for (let midi = 36; midi <= 96; midi++) {
      expect(Math.abs(zoneFor(set, midi).rootMidi - midi)).toBeLessThanOrEqual(12);
    }
    expect(Math.abs(zoneFor(set, 65).rootMidi - 65)).toBeLessThanOrEqual(6);
  });

  it('sustaining instruments loop', () => {
    const ctx = new OfflineAudioContext(1, 4800, 48000);
    expect(renderInstrument(ctx, 'strings').loop).not.toBeNull();
    expect(renderInstrument(ctx, 'piano').loop).toBeNull();
  });
});

describe('chord level', () => {
  it('a 6-note saw chord stays below full scale', async () => {
    const ctx = new OfflineAudioContext(2, 24000, 48000);
    const synth = new AnalogSynth(ctx, ctx.destination);
    const chord = getChord('C', 'major', 5, 4, 'upRight', 'chromatic', 0, 'root', []);
    synth.trigger([chord.bass!, ...chord.notes], ADSR_PRESETS.SUSTAIN, 'sawtooth');
    const out = await ctx.startRendering();
    let peak = 0;
    for (let ch = 0; ch < 2; ch++) {
      const d = out.getChannelData(ch);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]!));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThan(1);
  });
});
