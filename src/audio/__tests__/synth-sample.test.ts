import { describe, it, expect } from 'vitest';
import { SampleSynth } from '@/audio/synth-sample';
import { ADSR_PRESETS } from '@/audio/types';

function makePlaceholderBuffer(ctx: OfflineAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, 48000, 48000);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
  }
  return buffer;
}

describe('SampleSynth', () => {
  it('produces non-silent audio when triggered with a buffer', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new SampleSynth(ctx, output);
    const sampleBuffer = makePlaceholderBuffer(ctx);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
      { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
      { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.TOUCH, sampleBuffer);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });

  it('caches samples loaded via loadSampleFromBuffer and stops voices on stop()', async () => {
    const ctx = new OfflineAudioContext(2, 48000 * 2, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new SampleSynth(ctx, output);
    const sampleBuffer = makePlaceholderBuffer(ctx);
    synth.loadSampleFromBuffer('placeholder', sampleBuffer);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.SHORT, sampleBuffer);
    synth.stop();

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const lastQuarter = data.slice(data.length * 3 / 4);
    const maxTail = Math.max(...Array.from(lastQuarter).map(Math.abs));
    expect(maxTail).toBeLessThan(0.01);
  });
});
