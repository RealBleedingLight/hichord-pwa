import { describe, it, expect } from 'vitest';
import { BUILTIN_INSTRUMENTS, renderInstrument } from '@/audio/instruments';
import { AnalogSynth } from '@/audio/synth-analog';
import { ADSR_PRESETS } from '@/audio/types';
import { getChord } from '@/music/chord-engine';

describe('built-in sample instruments', () => {
  for (const { id } of BUILTIN_INSTRUMENTS) {
    it(`${id} renders a normalised, non-silent buffer`, () => {
      const ctx = new OfflineAudioContext(1, 4800, 48000);
      const buf = renderInstrument(ctx, id);
      const data = buf.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]!));
      expect(peak).toBeGreaterThan(0.5);
      expect(peak).toBeLessThanOrEqual(0.9001);
    });
  }
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
