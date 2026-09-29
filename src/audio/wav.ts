/** Encodes stereo float PCM as a 16-bit WAV file. */
export function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const frames = Math.min(left.length, right.length);
  const bytesPerFrame = 4;
  const buffer = new ArrayBuffer(44 + frames * bytesPerFrame);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + frames * bytesPerFrame, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // format = PCM
  view.setUint16(22, 2, true);           // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, frames * bytesPerFrame, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of [left, right]) {
      const v = Math.max(-1, Math.min(1, ch[i] ?? 0));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export interface LoopTrackAudio {
  left: Float32Array;
  right: Float32Array;
  gain: number;
  pan?: number;
  muted: boolean;
}

/**
 * Sums the audible tracks into one stereo loop, repeated `repeats` times.
 * Peaks above full scale are scaled down rather than clipped.
 */
export function mixdown(tracks: (LoopTrackAudio | null)[], loopLength: number, repeats = 1): { left: Float32Array; right: Float32Array } {
  const total = loopLength * repeats;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  for (const t of tracks) {
    if (!t || t.muted) continue;
    const angle = ((t.pan ?? 0) + 1) * Math.PI / 4;
    const gl = t.gain * Math.cos(angle) * Math.SQRT2;
    const gr = t.gain * Math.sin(angle) * Math.SQRT2;
    for (let i = 0; i < total; i++) {
      const j = i % loopLength;
      left[i]! += (t.left[j] ?? 0) * gl;
      right[i]! += (t.right[j] ?? 0) * gr;
    }
  }
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  if (peak > 0.99) {
    const k = 0.99 / peak;
    for (let i = 0; i < total; i++) { left[i]! *= k; right[i]! *= k; }
  }
  return { left, right };
}

/** Linear resample (used when restored loops were recorded at another sample rate). */
export function resample(data: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return data;
  const out = new Float32Array(Math.round((data.length * to) / from));
  const ratio = from / to;
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const frac = x - i0;
    out[i] = (data[i0] ?? 0) * (1 - frac) + (data[i0 + 1] ?? data[i0] ?? 0) * frac;
  }
  return out;
}
