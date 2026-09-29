import { describe, it, expect } from 'vitest';
import { encodeWav, mixdown, resample } from '@/audio/wav';
import { MasterClock } from '@/audio/clock';
import { AnalogSynth } from '@/audio/synth-analog';
import { ADSR_PRESETS } from '@/audio/types';
import { getChord } from '@/music/chord-engine';

describe('WAV export', () => {
  it('writes a valid 16-bit stereo header', async () => {
    const blob = encodeWav(new Float32Array(100), new Float32Array(100), 48000);
    const view = new DataView(await blob.arrayBuffer());
    const ascii = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
    expect(ascii(0)).toBe('RIFF');
    expect(ascii(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(400);
  });

  it('mixes unmuted tracks, repeats, and never exceeds full scale', () => {
    const one = new Float32Array([0.8, 0.8]);
    const tracks = [
      { left: one, right: one, gain: 1, muted: false },
      { left: one, right: one, gain: 1, muted: false },
      { left: one, right: one, gain: 1, muted: true },
    ];
    const { left } = mixdown(tracks, 2, 3);
    expect(left).toHaveLength(6);
    expect(Math.max(...left)).toBeLessThanOrEqual(0.9901);
  });

  it('resamples to the new rate', () => {
    expect(resample(new Float32Array(441), 44100, 48000)).toHaveLength(480);
  });
});

describe('swing', () => {
  it('delays odd steps by the swing fraction', async () => {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const clock = new MasterClock(ctx);
    clock.setBpm(300);
    clock.setRate('1/32'); // 25 ms steps, so several fall inside the 100 ms lookahead
    clock.setSwing(1 / 3);
    const times: number[] = [];
    clock.onTick((t) => times.push(t));
    clock.start(0);
    clock.stop();
    const step = clock.getStepDuration();
    expect(times[0]).toBeCloseTo(0, 6);
    expect(times[1]).toBeCloseTo(step + step / 3, 6);
    expect(times[2]).toBeCloseTo(2 * step, 6);
  });
});

describe('chord morph', () => {
  it('morphing into a bigger chord keeps sounding (adds a voice, no cut)', async () => {
    const ctx = new OfflineAudioContext(2, 24000, 48000);
    const synth = new AnalogSynth(ctx, ctx.destination);
    const c = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'off', []);
    const cmaj7 = getChord('C', 'major', 1, 4, 'right', 'default', 0, 'off', []);
    synth.trigger(c.notes, ADSR_PRESETS.SUSTAIN, 'sawtooth');
    synth.morph(cmaj7.notes, ADSR_PRESETS.SUSTAIN);
    const out = (await ctx.startRendering()).getChannelData(0);
    let s = 0;
    for (let i = 12000; i < 24000; i++) s += out[i]! ** 2;
    expect(Math.sqrt(s / 12000)).toBeGreaterThan(0.05);
    expect(out.some((v) => Number.isNaN(v))).toBe(false);
  });
});
