/**
 * Synthetic reverb impulse responses. Much closer to a real space than plain
 * decaying white noise:
 *  - pre-delay before the tail,
 *  - discrete early reflections (rooms/halls),
 *  - independent noise per channel for a wide, decorrelated stereo image,
 *  - high frequencies decay faster than lows (air/wall absorption),
 *  - RMS-normalised so switching type doesn't jump in level.
 */
export type ReverbKind = 'room' | 'hall' | 'plate';

interface ReverbShape {
  rt60: number;          // seconds to decay by 60 dB
  preDelay: number;      // seconds
  brightStart: number;   // low-pass cutoff at the start of the tail (Hz)
  brightEnd: number;     // cutoff by the end of the tail (Hz)
  reflections: number;   // number of early reflections
  reflectionSpan: number; // seconds over which they arrive
}

const SHAPES: Record<ReverbKind, ReverbShape> = {
  room: { rt60: 0.8, preDelay: 0.006, brightStart: 7000, brightEnd: 1500, reflections: 10, reflectionSpan: 0.04 },
  hall: { rt60: 2.6, preDelay: 0.022, brightStart: 8000, brightEnd: 1200, reflections: 14, reflectionSpan: 0.09 },
  plate: { rt60: 1.8, preDelay: 0.0, brightStart: 12000, brightEnd: 4000, reflections: 0, reflectionSpan: 0 },
};

/** Small deterministic PRNG so the IR is the same every launch. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildImpulseResponse(ctx: BaseAudioContext, kind: ReverbKind): AudioBuffer {
  const shape = SHAPES[kind];
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * (shape.preDelay + shape.rt60 * 1.1));
  const buffer = ctx.createBuffer(2, length, sr);
  const preSamples = Math.floor(shape.preDelay * sr);
  const decayRate = 6.9 / shape.rt60; // e^(-6.9) ≈ -60 dB

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const rand = rng(1234 + ch * 777 + kind.length * 31);
    let lp = 0;
    for (let i = preSamples; i < length; i++) {
      const t = (i - preSamples) / sr;
      const frac = Math.min(1, t / shape.rt60);
      const cutoff = shape.brightStart * Math.pow(shape.brightEnd / shape.brightStart, frac);
      const a = Math.exp((-2 * Math.PI * cutoff) / sr);
      const noise = rand() * 2 - 1;
      lp = a * lp + (1 - a) * noise;
      const fadeIn = Math.min(1, t / 0.004);
      // Plates have a denser, brighter wash: mix a little unfiltered noise back in.
      const src = kind === 'plate' ? lp * 0.8 + noise * 0.2 : lp;
      data[i] = src * Math.exp(-decayRate * t) * fadeIn;
    }
    for (let r = 0; r < shape.reflections; r++) {
      const at = preSamples + Math.floor((0.003 + rand() * shape.reflectionSpan) * sr);
      if (at < length) data[at]! += (rand() < 0.5 ? -1 : 1) * (0.9 - (0.6 * r) / shape.reflections) * 0.5;
    }
  }

  // Normalise energy so every type sits at a similar level.
  let sum = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) sum += d[i]! * d[i]!;
  }
  const k = 0.35 / Math.sqrt(sum / 2 / (sr * 0.1)); // RMS over an equivalent 100 ms
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) d[i]! *= k;
  }
  return buffer;
}
