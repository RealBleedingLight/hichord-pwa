import { describe, it, expect } from 'vitest';
import { AnalogSynth } from '@/audio/synth-analog';
import { ADSR_PRESETS } from '@/audio/types';

describe('AnalogSynth', () => {
  it('creates 6 stereo oscillator pairs', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);
    expect(synth.getVoiceCount()).toBe(6);
  });

  it('triggers notes and produces non-silent audio', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
      { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
      { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.TOUCH, 'sawtooth');

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });

  it('stops all oscillators on stop()', async () => {
    const ctx = new OfflineAudioContext(2, 48000 * 2, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.SHORT, 'sine');
    synth.stop();

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    // Last quarter of buffer should be silent after stop
    const lastQuarter = data.slice(data.length * 3 / 4);
    const maxTail = Math.max(...Array.from(lastQuarter).map(Math.abs));
    expect(maxTail).toBeLessThan(0.01);
  });
});
