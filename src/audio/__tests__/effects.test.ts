import { describe, it, expect } from 'vitest';
import { EffectsChain } from '@/audio/effects';

describe('EffectsChain', () => {
  it('passes audio through when all effects bypassed', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const chain = new EffectsChain(ctx);
    chain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(chain.getInput());
    osc.start(0);
    osc.stop(0.5);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data).map(Math.abs));
    expect(max).toBeGreaterThan(0.1);
  });

  it('reduces high frequencies when filter enabled', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const chain = new EffectsChain(ctx);
    chain.connect(ctx.destination);
    chain.setEffect('filter', true, 200); // 200Hz cutoff — should kill 5000Hz

    const osc = ctx.createOscillator();
    osc.frequency.value = 5000;
    osc.connect(chain.getInput());
    osc.start(0);
    osc.stop(0.5);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data.slice(4800)).map(Math.abs));
    expect(max).toBeLessThan(0.1);
  });
});
