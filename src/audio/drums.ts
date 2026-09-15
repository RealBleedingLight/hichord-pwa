import type { DrumKitName, DrumSound } from './types';

const BASE_DRUM_SOUNDS: DrumSound[] = ['kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH'];

/** New sounds map to closest existing audio for synthesis fallback. */
const SOUND_FALLBACK: Partial<Record<DrumSound, DrumSound>> = {
  clap: 'snare',
  rim: 'closedHH',
  tomHigh: 'tom',
  tomLow: 'tom',
  perc: 'bellRide',
  crash: 'bellRide',
  ride: 'bellRide',
  shaker: 'closedHH',
  fx1: 'kick',
  fx2: 'snare',
  fx3: 'openHH',
  fx4: 'tom',
};

const DRUM_SOUNDS: DrumSound[] = [
  ...BASE_DRUM_SOUNDS,
  'clap', 'rim', 'tomHigh', 'tomLow', 'perc', 'crash', 'ride', 'shaker',
  'fx1', 'fx2', 'fx3', 'fx4',
];

export class DrumEngine {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private kits: Map<DrumKitName, Map<DrumSound, AudioBuffer>> = new Map();
  private currentKit: DrumKitName = 'tight';

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.loadSynthKit('tight');
  }

  private loadSynthKit(name: DrumKitName): void {
    const kit = new Map<DrumSound, AudioBuffer>();
    for (const sound of DRUM_SOUNDS) {
      kit.set(sound, this.generateSynthDrum(sound));
    }
    this.kits.set(name, kit);
  }

  generateSynthDrum(sound: DrumSound): AudioBuffer {
    // For expanded sounds, delegate to the base sound they fall back to
    const resolved = SOUND_FALLBACK[sound] ?? sound;
    return this.generateBaseDrum(resolved);
  }

  private generateBaseDrum(sound: DrumSound): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    switch (sound) {
      case 'kick':
      case 'altKick': {
        const startFreq = sound === 'altKick' ? 180 : 150;
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const freq = startFreq * Math.exp(-t * 40);
          const env = Math.exp(-t * 8);
          data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
        }
        break;
      }
      case 'snare': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 20);
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 15);
          data[i] = (tone * 0.5 + noise * 0.5) * 0.7;
        }
        break;
      }
      case 'closedHH': {
        const short = Math.floor(sampleRate * 0.08);
        for (let i = 0; i < short; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.5;
        }
        break;
      }
      case 'openHH': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.4;
        }
        break;
      }
      case 'tom': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const freq = 120 * Math.exp(-t * 15);
          data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.6;
        }
        break;
      }
      case 'bellRide': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const bell = Math.sin(2 * Math.PI * 800 * t) * 0.3 + Math.sin(2 * Math.PI * 1200 * t) * 0.2;
          const noise = (Math.random() * 2 - 1) * 0.1;
          data[i] = (bell + noise) * Math.exp(-t * 4) * 0.5;
        }
        break;
      }
      default:
        // Any unrecognized base sound falls through silently (empty buffer)
        break;
    }
    return buffer;
  }

  triggerDrum(sound: DrumSound): void {
    const kit = this.kits.get(this.currentKit);
    const buffer = kit?.get(sound);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }

  setKit(kit: DrumKitName): void {
    this.currentKit = kit;
    if (!this.kits.has(kit)) {
      this.loadSynthKit(kit);
    }
  }

  async loadKit(kit: DrumKitName): Promise<void> {
    if (!this.kits.has(kit)) {
      this.loadSynthKit(kit);
    }
    this.currentKit = kit;
  }
}
