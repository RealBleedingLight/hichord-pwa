/**
 * Built-in instruments for the SAMPLE synth mode, rendered procedurally (the
 * app ships no audio files) the first time each is selected.
 *
 * Each instrument is multi-sampled — one zone per octave — so a note is never
 * pitch-shifted more than half an octave (no chipmunk highs / muddy lows), and
 * timbre and decay change naturally across the range like a real instrument.
 * Sustaining instruments carry a crossfaded loop so held chords never run out.
 */

export const BUILTIN_INSTRUMENTS = [
  { id: 'piano', label: 'PIANO' },
  { id: 'keys', label: 'E.PIANO' },
  { id: 'pluck', label: 'GUITAR' },
  { id: 'strings', label: 'STRINGS' },
  { id: 'organ', label: 'ORGAN' },
  { id: 'pad', label: 'PAD' },
  { id: 'bell', label: 'BELL' },
] as const;

export type BuiltinInstrument = typeof BUILTIN_INSTRUMENTS[number]['id'];

export interface SampleZone {
  rootMidi: number;
  buffer: AudioBuffer;
}

export interface SampleSet {
  zones: SampleZone[];
  /** Loop region in seconds (sustaining instruments), or null for one-shots. */
  loop: { start: number; end: number } | null;
}

/** Kept for callers that only need a single-zone root (mic samples). */
export const INSTRUMENT_ROOT_MIDI = 60;

export function isBuiltinInstrument(name: string): name is BuiltinInstrument {
  return BUILTIN_INSTRUMENTS.some((i) => i.id === name);
}

/** Picks the zone whose root is closest to `midi`. */
export function zoneFor(set: SampleSet, midi: number): SampleZone {
  let best = set.zones[0]!;
  for (const z of set.zones) if (Math.abs(z.rootMidi - midi) < Math.abs(best.rootMidi - midi)) best = z;
  return best;
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Adds a sine partial using a rotating phasor (a few multiplies per sample
 * instead of Math.sin) — fast enough to render several zones on a phone.
 */
function addPartial(data: Float32Array, sr: number, freq: number, amp: (t: number) => number, envStep = 64): void {
  if (freq >= sr / 2 - 100) return;
  const w = (2 * Math.PI * freq) / sr;
  const c = Math.cos(w);
  const s = Math.sin(w);
  let x = 1;
  let y = 0;
  let a = amp(0);
  for (let i = 0; i < data.length; i++) {
    if (i % envStep === 0) {
      a = amp(i / sr);
      if (a < 1e-5 && i > sr * 0.05) return; // inaudible from here on
      // Renormalise the phasor now and then so it doesn't drift.
      const m = 1 / Math.sqrt(x * x + y * y);
      x *= m;
      y *= m;
    }
    data[i]! += y * a;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
  }
}

function normalize(data: Float32Array, peak = 0.9): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]!));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < data.length; i++) data[i]! *= k;
}

function fadeEdges(data: Float32Array, sr: number, fadeOut = true): void {
  const fadeIn = Math.floor(sr * 0.002);
  for (let i = 0; i < fadeIn && i < data.length; i++) data[i]! *= i / fadeIn;
  if (!fadeOut) return;
  const out = Math.floor(sr * 0.05);
  for (let i = 0; i < out && i < data.length; i++) data[data.length - 1 - i]! *= i / out;
}

/** Crossfades the end of the loop into the audio before its start, so it repeats seamlessly. */
function makeLoopable(data: Float32Array, sr: number, start: number, end: number): void {
  const s0 = Math.floor(start * sr);
  const e0 = Math.floor(end * sr);
  const xf = Math.floor(sr * 0.25);
  for (let i = 0; i < xf; i++) {
    const a = i / xf;
    const endIdx = e0 - xf + i;
    const startIdx = s0 - xf + i;
    data[endIdx] = data[endIdx]! * (1 - a) + data[startIdx]! * a;
  }
}

// --- Instrument models ------------------------------------------------------

function renderPiano(data: Float32Array, sr: number, f: number, midi: number): void {
  // Stiff strings: partial n sits at n·f·√(1+B·n²). Two slightly detuned
  // strings per note give the natural beating; decay is faster for higher
  // partials and higher notes, with a quicker "prompt" stage then a long tail.
  const B = 0.00008 * Math.pow(2, (midi - 48) / 18);
  const pitchDecay = Math.pow(2, (midi - 60) / 24);
  for (let n = 1; n <= 14; n++) {
    const fn = n * f * Math.sqrt(1 + B * n * n);
    const amp = 0.9 / Math.pow(n, 1.1) * (n === 1 ? 1 : 0.85);
    const fast = (2.5 + n * 1.2) * pitchDecay;
    const slow = (0.35 + n * 0.12) * pitchDecay;
    for (const detune of [-0.0006, 0.0006]) {
      addPartial(data, sr, fn * (1 + detune), (t) => amp * (0.55 * Math.exp(-t * fast) + 0.45 * Math.exp(-t * slow)));
    }
  }
  // Hammer thump: a few ms of low-passed noise.
  let lp = 0;
  const hammerLen = Math.floor(sr * 0.012);
  for (let i = 0; i < hammerLen; i++) {
    lp = lp * 0.85 + (Math.random() * 2 - 1) * 0.15;
    data[i]! += lp * 0.6 * (1 - i / hammerLen);
  }
}

function renderEPiano(data: Float32Array, sr: number, f: number, midi: number): void {
  const pitchDecay = Math.pow(2, (midi - 60) / 24);
  for (let h = 1; h <= 6; h++) {
    addPartial(data, sr, f * h, (t) => Math.exp(-t * (0.8 + h * 0.9) * pitchDecay) / (h * h));
  }
  // The metallic "tine" that gives the bell-like attack.
  addPartial(data, sr, f * 7.1, (t) => 0.25 * Math.exp(-t * 18));
}

/**
 * Karplus–Strong string with a pick-position comb and a hint of body
 * resonance. Returns the string's true pitch: the loop can only be a whole
 * number of samples (+½ for the averaging filter), so the zone's root is set
 * to the exact pitch rendered and playback corrects for it.
 */
function renderGuitar(data: Float32Array, sr: number, f: number): number {
  const n = Math.max(2, Math.round(sr / f - 0.5));
  const ring = new Float32Array(n);
  const pick = Math.max(1, Math.floor(n * 0.13));
  for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = n - 1; i >= pick; i--) ring[i] = ring[i]! - ring[i - pick]!; // pluck position
  // Loss per round trip chosen so every string rings for ~2.5 s.
  const damping = 1 - 1 / (2.5 * f);
  let idx = 0;
  let body1 = 0;
  let body2 = 0;
  for (let i = 0; i < data.length; i++) {
    const next = (idx + 1) % n;
    const out = ring[idx]!;
    ring[idx] = damping * 0.5 * (ring[idx]! + ring[next]!);
    idx = next;
    body1 = body1 * 0.995 + out * 0.005;
    body2 = body2 * 0.985 + out * 0.015;
    data[i] = out + body1 * 2 + body2;
  }
  // Gentle saturation lifts the ring relative to the pick transient (like a compressor).
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]!));
  const drive = 3 / (peak || 1);
  for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i]! * drive);
  return sr / (n + 0.5);
}

function renderStrings(data: Float32Array, sr: number, f: number): void {
  // Section of 3 slightly detuned players, each a band-limited saw with its own
  // slow vibrato; darker upper harmonics like bowed strings.
  const players = [-0.004, 0.0003, 0.0042];
  const maxH = Math.min(16, Math.floor(sr / 2 / f / 1.05));
  players.forEach((d, p) => {
    const vibRate = 4.6 + p * 0.37;
    for (let h = 1; h <= maxH; h++) {
      const amp = (1 / h) * Math.exp(-h / 14);
      // Approximate vibrato as a small amplitude shimmer (true FM would need per-sample phase).
      addPartial(data, sr, f * h * (1 + d), (t) => amp * (0.9 + 0.1 * Math.sin(2 * Math.PI * vibRate * t + p)), 64);
    }
  });
}

function renderOrgan(data: Float32Array, sr: number, f: number): void {
  // Drawbar-style tone: 16' 8' 5⅓' 4' 2' 1' with a short key click.
  const bars: [number, number][] = [[0.5, 0.6], [1, 1], [1.5, 0.6], [2, 0.7], [4, 0.45], [8, 0.25]];
  for (const [ratio, amp] of bars) addPartial(data, sr, f * ratio, () => amp);
  const click = Math.floor(sr * 0.004);
  for (let i = 0; i < click; i++) data[i]! += (Math.random() * 2 - 1) * 0.3 * (1 - i / click);
}

function renderPad(data: Float32Array, sr: number, f: number): void {
  const detunes = [-0.006, 0, 0.0065];
  const maxH = Math.min(10, Math.floor(sr / 2 / f / 1.05));
  for (const d of detunes) {
    for (let h = 1; h <= maxH; h++) {
      addPartial(data, sr, f * (1 + d) * h, (t) => (1 / h) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.3 * t)), 128);
    }
  }
}

function renderBell(data: Float32Array, sr: number, f: number): void {
  const partials: [number, number, number][] = [
    [1, 1, 0.9], [2, 0.6, 1.4], [2.76, 0.45, 2], [5.4, 0.3, 3.5], [8.93, 0.2, 5],
  ];
  for (const [ratio, amp, decay] of partials) addPartial(data, sr, f * ratio, (t) => amp * Math.exp(-t * decay));
}

interface InstrumentDef {
  roots: number[];
  seconds: (midi: number) => number;
  loop: { start: number; end: number } | null;
  /** May return the exact pitch rendered, if it differs from the requested one. */
  render: (data: Float32Array, sr: number, freq: number, midi: number) => number | void;
}

const ONE_SHOT_ROOTS = [36, 48, 60, 72, 84];
const SUSTAIN_ROOTS = [36, 48, 60, 72, 84];
const SUSTAIN_LOOP = { start: 1.0, end: 3.0 };

const DEFS: Record<BuiltinInstrument, InstrumentDef> = {
  piano: { roots: ONE_SHOT_ROOTS, seconds: (m) => (m < 50 ? 5 : m < 70 ? 4 : 2.5), loop: null, render: renderPiano },
  keys: { roots: ONE_SHOT_ROOTS, seconds: () => 3, loop: null, render: renderEPiano },
  pluck: { roots: [40, 52, 64, 76], seconds: () => 3, loop: null, render: (d, sr, f) => renderGuitar(d, sr, f) },
  strings: { roots: SUSTAIN_ROOTS, seconds: () => 3.2, loop: SUSTAIN_LOOP, render: (d, sr, f) => renderStrings(d, sr, f) },
  organ: { roots: SUSTAIN_ROOTS, seconds: () => 3.2, loop: SUSTAIN_LOOP, render: (d, sr, f) => renderOrgan(d, sr, f) },
  pad: { roots: SUSTAIN_ROOTS, seconds: () => 3.2, loop: SUSTAIN_LOOP, render: (d, sr, f) => renderPad(d, sr, f) },
  bell: { roots: [48, 60, 72, 84], seconds: () => 4, loop: null, render: (d, sr, f) => renderBell(d, sr, f) },
};

export function renderInstrument(ctx: BaseAudioContext, name: BuiltinInstrument): SampleSet {
  const def = DEFS[name];
  const sr = ctx.sampleRate;
  const zones = def.roots.map((rootMidi) => {
    const buffer = ctx.createBuffer(1, Math.floor(sr * def.seconds(rootMidi)), sr);
    const data = buffer.getChannelData(0);
    const actual = def.render(data, sr, midiToFreq(rootMidi), rootMidi);
    normalize(data);
    if (def.loop) makeLoopable(data, sr, def.loop.start, def.loop.end);
    fadeEdges(data, sr, !def.loop);
    const root = typeof actual === 'number' ? 69 + 12 * Math.log2(actual / 440) : rootMidi;
    return { rootMidi: root, buffer };
  });
  return { zones, loop: def.loop };
}

/** Wraps a single recording (e.g. a mic take) as a one-zone instrument. */
export function singleZone(buffer: AudioBuffer, rootMidi: number): SampleSet {
  return { zones: [{ rootMidi, buffer }], loop: null };
}
