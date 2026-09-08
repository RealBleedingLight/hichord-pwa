import { describe, it, expect } from 'vitest';
import { DrumEngine } from '@/audio/drums';

describe('DrumEngine', () => {
  it('generates synth drum sounds', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const drums = new DrumEngine(ctx, output);

    const kickBuffer = drums.generateSynthDrum('kick');
    expect(kickBuffer).toBeInstanceOf(AudioBuffer);
    expect(kickBuffer.length).toBeGreaterThan(0);
  });

  it('produces audio when triggering a drum', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const drums = new DrumEngine(ctx, output);

    drums.triggerDrum('kick');

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data).map(Math.abs));
    expect(max).toBeGreaterThan(0.01);
  });

  it('maps all 7 drum sounds', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    const drums = new DrumEngine(ctx, output);

    const sounds: import('@/audio/types').DrumSound[] = [
      'kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH',
    ];
    for (const sound of sounds) {
      const buf = drums.generateSynthDrum(sound);
      expect(buf.length).toBeGreaterThan(0);
    }
  });

  it('loads a kit and can trigger drums after loading', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const drums = new DrumEngine(ctx, output);

    await drums.loadKit('trap');
    drums.triggerDrum('snare');

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data).map(Math.abs));
    expect(max).toBeGreaterThan(0.01);
  });
});
