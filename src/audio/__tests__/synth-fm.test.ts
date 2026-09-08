import { describe, it, expect } from 'vitest';
import { FMSynth } from '@/audio/synth-fm';
import { ADSR_PRESETS, FM_PRESETS } from '@/audio/types';

describe('FMSynth', () => {
  it('produces non-silent audio', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new FMSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
      { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
      { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.TOUCH, FM_PRESETS[0]);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });

  it('stops all voices on stop()', async () => {
    const ctx = new OfflineAudioContext(2, 48000 * 2, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new FMSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.SHORT, FM_PRESETS[0]);
    synth.stop();

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const lastQuarter = data.slice(data.length * 3 / 4);
    const maxTail = Math.max(...Array.from(lastQuarter).map(Math.abs));
    expect(maxTail).toBeLessThan(0.01);
  });
});
