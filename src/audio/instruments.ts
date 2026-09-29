/**
 * Built-in instruments for the SAMPLE synth mode. The app ships no audio
 * files, so each instrument is rendered procedurally into an AudioBuffer at
 * C4 (midi 60) the first time it is selected, then pitch-shifted per note.
 */

export const BUILTIN_INSTRUMENTS = [
  { id: 'keys', label: 'KEYS' },
  { id: 'pluck', label: 'PLUCK' },
  { id: 'bell', label: 'BELL' },
  { id: 'pad', label: 'PAD' },
] as const;

export type BuiltinInstrument = typeof BUILTIN_INSTRUMENTS[number]['id'];

export const INSTRUMENT_ROOT_MIDI = 60;
const ROOT_FREQ = 261.6256;

export function isBuiltinInstrument(name: string): name is BuiltinInstrument {
  return BUILTIN_INSTRUMENTS.some((i) => i.id === name);
}

function normalize(data: Float32Array, peak = 0.9): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]!));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < data.length; i++) data[i]! *= k;
}

/** Short fade-in/out so the one-shot never starts or ends with a click. */
function fadeEdges(data: Float32Array, sampleRate: number): void {
  const fadeIn = Math.floor(sampleRate * 0.002);
  const fadeOut = Math.floor(sampleRate * 0.05);
  for (let i = 0; i < fadeIn && i < data.length; i++) data[i]! *= i / fadeIn;
  for (let i = 0; i < fadeOut && i < data.length; i++) data[data.length - 1 - i]! *= i / fadeOut;
}

function renderKeys(data: Float32Array, sr: number): void {
  // Electric-piano-ish: decaying harmonics plus a quick metallic "tine".
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let v = 0;
    for (let h = 1; h <= 6; h++) {
      v += Math.sin(2 * Math.PI * ROOT_FREQ * h * t) * Math.exp(-t * (0.8 + h * 0.9)) / (h * h);
    }
    v += 0.25 * Math.sin(2 * Math.PI * ROOT_FREQ * 7.1 * t) * Math.exp(-t * 18);
    data[i] = v;
  }
}

function renderPluck(data: Float32Array, sr: number): void {
  // Karplus–Strong plucked string.
  const period = Math.round(sr / ROOT_FREQ);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < data.length; i++) {
    const next = (idx + 1) % period;
    const out = ring[idx]!;
    ring[idx] = 0.996 * 0.5 * (ring[idx]! + ring[next]!);
    data[i] = out;
    idx = next;
  }
}

function renderBell(data: Float32Array, sr: number): void {
  const partials: [number, number, number][] = [
    // ratio, amplitude, decay rate
    [1, 1, 0.9], [2, 0.6, 1.4], [2.76, 0.45, 2], [5.4, 0.3, 3.5], [8.93, 0.2, 5],
  ];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let v = 0;
    for (const [ratio, amp, decay] of partials) {
      v += amp * Math.sin(2 * Math.PI * ROOT_FREQ * ratio * t) * Math.exp(-t * decay);
    }
    data[i] = v;
  }
}

function renderPad(data: Float32Array, sr: number): void {
  // Three detuned band-limited saws with a slow shimmer.
  const detunes = [-0.006, 0, 0.0065];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let v = 0;
    for (const d of detunes) {
      const f = ROOT_FREQ * (1 + d);
      for (let h = 1; h <= 10; h++) v += Math.sin(2 * Math.PI * f * h * t) / h;
    }
    data[i] = v * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.3 * t));
  }
}

const DURATIONS: Record<BuiltinInstrument, number> = {
  keys: 3,
  pluck: 2.5,
  bell: 4,
  pad: 4,
};

export function renderInstrument(ctx: BaseAudioContext, name: BuiltinInstrument): AudioBuffer {
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(sr * DURATIONS[name]), sr);
  const data = buffer.getChannelData(0);
  switch (name) {
    case 'keys': renderKeys(data, sr); break;
    case 'pluck': renderPluck(data, sr); break;
    case 'bell': renderBell(data, sr); break;
    case 'pad': renderPad(data, sr); break;
  }
  normalize(data);
  fadeEdges(data, sr);
  return buffer;
}
