import type { DrumKitName, DrumSound } from './types';

const DRUM_SOUNDS: DrumSound[] = [
  'kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH',
  'clap', 'rim', 'tomHigh', 'tomLow', 'perc', 'crash', 'ride', 'shaker',
  'fx1', 'fx2', 'fx3', 'fx4',
];

/**
 * Per-kit synthesis character. Every kit is synthesised (no sample files), so
 * these knobs are what make the 808 boom, the 909 punch, the trap kit sub out
 * and so on.
 */
interface KitParams {
  kickStart: number;   // Hz at the transient
  kickEnd: number;     // Hz it settles to
  kickSweep: number;   // pitch drop speed
  kickDecay: number;   // amplitude decay rate (lower = longer)
  kickClick: number;   // transient click amount
  kickDrive: number;   // soft-clip saturation
  snareTone: number;   // body pitch
  snareNoise: number;  // 0–1 noise vs tone
  snareDecay: number;
  hatDecay: number;    // closed hat decay rate
  hatTone: number;     // 0 = dark/noisy, 1 = bright/metallic
  tomPitch: number;
  gain: number;
}

const KIT_PARAMS: Record<DrumKitName, KitParams> = {
  tight: { kickStart: 160, kickEnd: 55, kickSweep: 45, kickDecay: 10, kickClick: 0.3, kickDrive: 1.2, snareTone: 200, snareNoise: 0.55, snareDecay: 22, hatDecay: 90, hatTone: 0.6, tomPitch: 130, gain: 1 },
  x0x:   { kickStart: 120, kickEnd: 48, kickSweep: 22, kickDecay: 3.2, kickClick: 0.1, kickDrive: 1.1, snareTone: 180, snareNoise: 0.6, snareDecay: 16, hatDecay: 70, hatTone: 0.9, tomPitch: 110, gain: 1 },
  x9x:   { kickStart: 220, kickEnd: 52, kickSweep: 55, kickDecay: 7, kickClick: 0.6, kickDrive: 2, snareTone: 230, snareNoise: 0.7, snareDecay: 18, hatDecay: 60, hatTone: 0.8, tomPitch: 140, gain: 1 },
  lynn:  { kickStart: 140, kickEnd: 60, kickSweep: 35, kickDecay: 12, kickClick: 0.4, kickDrive: 1.4, snareTone: 190, snareNoise: 0.5, snareDecay: 12, hatDecay: 80, hatTone: 0.4, tomPitch: 120, gain: 1 },
  kr78:  { kickStart: 110, kickEnd: 70, kickSweep: 30, kickDecay: 18, kickClick: 0.05, kickDrive: 1, snareTone: 260, snareNoise: 0.35, snareDecay: 28, hatDecay: 120, hatTone: 0.3, tomPitch: 160, gain: 1.1 },
  trap:  { kickStart: 100, kickEnd: 40, kickSweep: 12, kickDecay: 1.8, kickClick: 0.2, kickDrive: 2.4, snareTone: 210, snareNoise: 0.8, snareDecay: 14, hatDecay: 110, hatTone: 1, tomPitch: 100, gain: 0.95 },
  user:  { kickStart: 160, kickEnd: 55, kickSweep: 45, kickDecay: 10, kickClick: 0.3, kickDrive: 1.2, snareTone: 200, snareNoise: 0.55, snareDecay: 22, hatDecay: 90, hatTone: 0.6, tomPitch: 130, gain: 1 },
};

const TAU = 2 * Math.PI;
const noise = () => Math.random() * 2 - 1;

/** Sum of detuned squares — the classic analog "metal" source for hats/cymbals. */
function metal(t: number, bright: number): number {
  const freqs = [205, 304, 369, 522, 540, 800];
  let v = 0;
  for (const f of freqs) v += Math.sign(Math.sin(TAU * f * (1 + bright) * 2 * t));
  return v / freqs.length;
}

export class DrumEngine {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private kits: Map<DrumKitName, Map<DrumSound, AudioBuffer>> = new Map();
  private currentKit: DrumKitName = 'tight';
  private clickBuffers: { accent: AudioBuffer; beat: AudioBuffer } | null = null;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.loadSynthKit('tight');
  }

  private loadSynthKit(name: DrumKitName): void {
    const kit = new Map<DrumSound, AudioBuffer>();
    for (const sound of DRUM_SOUNDS) {
      kit.set(sound, this.renderDrum(sound, KIT_PARAMS[name]));
    }
    this.kits.set(name, kit);
  }

  generateSynthDrum(sound: DrumSound): AudioBuffer {
    return this.renderDrum(sound, KIT_PARAMS[this.currentKit]);
  }

  private renderDrum(sound: DrumSound, p: KitParams): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const long = sound === 'crash' || sound === 'ride' || sound === 'fx3' || sound === 'openHH' || (sound === 'kick' && p.kickDecay < 4);
    const length = Math.floor(sr * (long ? 1.5 : 0.6));
    const buffer = this.ctx.createBuffer(1, length, sr);
    const d = buffer.getChannelData(0);

    const kick = (start: number, end: number, sweep: number, decay: number, click: number, drive: number) => {
      let phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sr;
        const f = end + (start - end) * Math.exp(-t * sweep);
        phase += TAU * f / sr;
        const body = Math.sin(phase) * Math.exp(-t * decay);
        const clk = click * noise() * Math.exp(-t * 400);
        d[i] = Math.tanh((body + clk) * drive) * 0.9;
      }
    };
    const tom = (pitch: number) => {
      let phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sr;
        phase += TAU * pitch * (1 + 0.6 * Math.exp(-t * 20)) / sr;
        d[i] = Math.sin(phase) * Math.exp(-t * 9) * 0.7;
      }
    };

    switch (sound) {
      case 'kick':
        kick(p.kickStart, p.kickEnd, p.kickSweep, p.kickDecay, p.kickClick, p.kickDrive);
        break;
      case 'altKick':
        kick(p.kickStart * 1.3, p.kickEnd * 1.15, p.kickSweep * 1.2, p.kickDecay * 1.6, p.kickClick + 0.2, p.kickDrive);
        break;
      case 'snare':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          const tone = (Math.sin(TAU * p.snareTone * t) + 0.5 * Math.sin(TAU * p.snareTone * 1.6 * t)) * Math.exp(-t * 25);
          const n = noise() * Math.exp(-t * p.snareDecay);
          d[i] = (tone * (1 - p.snareNoise) + n * p.snareNoise) * 0.8;
        }
        break;
      case 'clap':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          // Three quick bursts then a tail — the "many hands" smear.
          let env = Math.exp(-t * 18) * 0.6;
          for (const off of [0, 0.011, 0.023]) {
            if (t >= off) env += Math.exp(-(t - off) * 180);
          }
          d[i] = noise() * env * 0.5;
        }
        break;
      case 'rim':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          d[i] = (Math.sin(TAU * 1700 * t) * 0.6 + noise() * 0.4) * Math.exp(-t * 90) * 0.8;
        }
        break;
      case 'closedHH':
      case 'shaker': {
        const decay = sound === 'shaker' ? 40 : p.hatDecay;
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          const src = sound === 'shaker' ? noise() : metal(t, p.hatTone * 0.3) * p.hatTone + noise() * (1 - p.hatTone);
          const env = sound === 'shaker' ? Math.min(1, t * 200) * Math.exp(-t * decay) : Math.exp(-t * decay);
          d[i] = src * env * 0.35;
        }
        // Crude high-pass: remove low-end rumble.
        for (let i = length - 1; i > 0; i--) d[i] = d[i]! - d[i - 1]! * 0.9;
        break;
      }
      case 'openHH':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          d[i] = (metal(t, p.hatTone * 0.3) * p.hatTone + noise() * (1 - p.hatTone)) * Math.exp(-t * 7) * 0.3;
        }
        for (let i = length - 1; i > 0; i--) d[i] = d[i]! - d[i - 1]! * 0.9;
        break;
      case 'crash':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          d[i] = (metal(t, 0.5) * 0.5 + noise() * 0.5) * Math.exp(-t * 2.5) * 0.35;
        }
        for (let i = length - 1; i > 0; i--) d[i] = d[i]! - d[i - 1]! * 0.8;
        break;
      case 'ride':
      case 'bellRide':
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          const bell = Math.sin(TAU * 820 * t) * 0.4 + Math.sin(TAU * 1230 * t) * 0.3 + Math.sin(TAU * 2890 * t) * 0.15;
          const wash = metal(t, 0.9) * (sound === 'ride' ? 0.3 : 0.1);
          d[i] = (bell + wash) * Math.exp(-t * (sound === 'ride' ? 3 : 5)) * 0.45;
        }
        break;
      case 'tom':
        tom(p.tomPitch);
        break;
      case 'tomHigh':
        tom(p.tomPitch * 1.5);
        break;
      case 'tomLow':
        tom(p.tomPitch * 0.7);
        break;
      case 'perc':
        // Cowbell: two detuned squares through a quick decay.
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          const v = Math.sign(Math.sin(TAU * 540 * t)) + Math.sign(Math.sin(TAU * 800 * t));
          d[i] = v * Math.exp(-t * 14) * 0.2;
        }
        break;
      case 'fx1': // laser zap
        {
          let phase = 0;
          for (let i = 0; i < length; i++) {
            const t = i / sr;
            phase += TAU * (2500 * Math.exp(-t * 18) + 80) / sr;
            d[i] = Math.sign(Math.sin(phase)) * Math.exp(-t * 8) * 0.25;
          }
        }
        break;
      case 'fx2': // sub drop
        kick(90, 30, 4, 3, 0, 1.5);
        break;
      case 'fx3': // reverse-swell noise
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          const env = Math.pow(t / (length / sr), 3);
          d[i] = noise() * env * 0.4;
        }
        break;
      case 'fx4': // blip
        for (let i = 0; i < length; i++) {
          const t = i / sr;
          d[i] = Math.sin(TAU * (t < 0.04 ? 1320 : 1760) * t) * Math.exp(-t * 20) * 0.4;
        }
        break;
      default:
        break;
    }

    if (p.gain !== 1) for (let i = 0; i < length; i++) d[i]! *= p.gain;
    return buffer;
  }

  /** Plays a drum hit, optionally scheduled at an AudioContext time. */
  triggerDrum(sound: DrumSound, when?: number, velocity = 1): void {
    const kit = this.kits.get(this.currentKit);
    const buffer = kit?.get(sound);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (velocity !== 1) {
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1.5, velocity));
      source.connect(g).connect(this.output);
    } else {
      source.connect(this.output);
    }
    source.start(Math.max(when ?? 0, this.ctx.currentTime));
  }

  /** Metronome click (accented on the downbeat) to `destination`, so it can bypass the looper. */
  triggerClick(accent: boolean, when: number, destination: AudioNode): void {
    if (!this.clickBuffers) {
      const make = (freq: number) => {
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * 0.05);
        const buf = this.ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.sin(TAU * freq * i / sr) * Math.exp(-i / sr * 90) * 0.5;
        return buf;
      };
      this.clickBuffers = { accent: make(1760), beat: make(1100) };
    }
    const source = this.ctx.createBufferSource();
    source.buffer = accent ? this.clickBuffers.accent : this.clickBuffers.beat;
    source.connect(destination);
    source.start(Math.max(when, this.ctx.currentTime));
  }

  setKit(kit: DrumKitName): void {
    this.currentKit = kit;
    if (!this.kits.has(kit)) {
      this.loadSynthKit(kit);
    }
  }

  async loadKit(kit: DrumKitName): Promise<void> {
    this.setKit(kit);
  }
}
