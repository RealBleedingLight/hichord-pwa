// Pure pitch-detection helpers shared by Tuner and MicSampler.
// Kept free of any Web Audio node dependencies so they can be unit tested
// directly against synthetic Float32Array buffers.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Autocorrelation-based fundamental-frequency detector (the classic "ACF2+"
 * approach). Returns the detected frequency in Hz, or -1 if the buffer is
 * too quiet / no clear pitch could be found.
 */
export function autocorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  if (SIZE < 4) return -1;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    const v = buffer[i]!;
    rms += v * v;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // Trim silence from the start/end so the autocorrelation window is
  // centered on the actual signal.
  const threshold = 0.2;
  let r1 = 0;
  let r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]!) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]!) < threshold) { r2 = SIZE - i; break; }
  }

  const trimmed = buffer.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 4) return -1;

  const c = new Float64Array(newSize);
  for (let lag = 0; lag < newSize; lag++) {
    let sum = 0;
    for (let i = 0; i < newSize - lag; i++) {
      sum += trimmed[i]! * trimmed[i + lag]!;
    }
    c[lag] = sum;
  }

  let d = 0;
  while (d < newSize - 1 && c[d]! > c[d + 1]!) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i]! > maxVal) {
      maxVal = c[i]!;
      maxPos = i;
    }
  }

  let T0 = maxPos;
  if (T0 <= 0) return -1;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  if (T0 > 0 && T0 < newSize - 1) {
    const x1 = c[T0 - 1]!;
    const x2 = c[T0]!;
    const x3 = c[T0 + 1]!;
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) T0 = T0 - b / (2 * a);
  }

  if (T0 <= 0) return -1;
  const freq = sampleRate / T0;
  if (!isFinite(freq) || freq <= 0) return -1;
  return freq;
}

export interface DetectedNote {
  note: string;
  cents: number;
}

/**
 * Maps a frequency in Hz to the nearest equal-tempered note name (A4 = 440Hz)
 * plus the cents deviation from that note (-50..+50).
 */
export function frequencyToNote(freq: number): DetectedNote {
  if (!isFinite(freq) || freq <= 0) return { note: '--', cents: 0 };

  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(freq / A4);
  const rounded = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - rounded) * 100);
  const midi = 69 + rounded;
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  return { note: `${NOTE_NAMES[noteIndex]}${octave}`, cents };
}
