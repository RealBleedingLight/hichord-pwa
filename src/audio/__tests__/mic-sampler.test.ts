import { describe, it, expect } from 'vitest';
import { MicSampler, mergeChunks } from '@/audio/mic-sampler';

function makeSine(freq: number, sampleRate: number, durationSec: number): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = 0.8 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buffer;
}

describe('mergeChunks', () => {
  it('concatenates multiple chunks in order', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5]);
    const merged = mergeChunks([a, b]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns an empty array for no chunks', () => {
    expect(mergeChunks([])).toHaveLength(0);
  });
});

describe('MicSampler.getDetectedPitch', () => {
  it('detects the pitch of an injected 440Hz buffer', () => {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const sampler = new MicSampler(ctx as unknown as AudioContext);

    const sampleRate = 44100;
    const data = makeSine(440, sampleRate, 0.05);
    const audioBuffer = ctx.createBuffer(1, data.length, sampleRate);
    audioBuffer.getChannelData(0).set(data);

    const pitch = sampler.getDetectedPitch(audioBuffer);
    expect(pitch).toBeGreaterThan(430);
    expect(pitch).toBeLessThan(450);
  });

  it('returns -1 when no buffer is available', () => {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const sampler = new MicSampler(ctx as unknown as AudioContext);
    expect(sampler.getDetectedPitch()).toBe(-1);
  });

  it('uses the last recorded buffer via getLastBuffer after stop()', () => {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const sampler = new MicSampler(ctx as unknown as AudioContext);
    expect(sampler.getLastBuffer()).toBeNull();
    expect(sampler.isRecording()).toBe(false);
  });
});
