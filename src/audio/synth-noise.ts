import type { Note } from '@/music/types';
import type { ADSREnvelope } from './types';
import { getNoiseWorkletUrl } from './noise-worklet';
import { applyAttack } from './envelope';
import { VoiceSet } from './voice-set';

/** registerProcessor may only run once per context, so share the load. */
const workletLoads = new WeakMap<BaseAudioContext, Promise<void>>();

/**
 * Noise instrument. A single noise source is fed through one resonant
 * band-pass filter per chord note, so the "noise" still plays the chord
 * (a breathy, wind-like pad) instead of an unpitched hiss.
 */
export class NoiseSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;
  private initialized = false;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  async init(): Promise<void> {
    if (this.initialized || !(this.ctx instanceof AudioContext)) return;
    let load = workletLoads.get(this.ctx);
    if (!load) {
      const url = getNoiseWorkletUrl();
      load = this.ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
      workletLoads.set(this.ctx, load);
    }
    await load;
    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized;
  }

  trigger(adsr: ADSREnvelope, type: 'white' | 'pink' | 'filtered' | 'metallic', notes: Note[] = [], when?: number): void {
    if (!(this.ctx instanceof AudioContext) || !this.initialized) return;
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);

    const noiseNode = new AudioWorkletNode(this.ctx, 'noise-processor');
    noiseNode.port.postMessage({ type: type === 'filtered' || type === 'metallic' ? 'white' : type });

    const envGain = this.ctx.createGain();
    envGain.connect(this.output);
    const filters: BiquadFilterNode[] = [];

    const pitched = notes.filter((n) => Number.isFinite(n.frequency)).slice(0, 6);
    if (pitched.length > 0) {
      // Narrow band-passes pass very little energy, so make up the gain.
      applyAttack(envGain.gain, adsr, now, 6 / Math.sqrt(pitched.length));
      for (const note of pitched) {
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = note.frequency;
        bp.Q.value = 30;
        noiseNode.connect(bp).connect(envGain);
        filters.push(bp);
      }
    } else {
      applyAttack(envGain.gain, adsr, now, 0.25);
      noiseNode.connect(envGain);
    }

    this.voices.add({
      gains: [envGain.gain],
      sources: [],
      dispose: () => {
        for (const node of [noiseNode, envGain, ...filters]) {
          try { node.disconnect(); } catch { /* already disconnected */ }
        }
      },
    });
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
  }
}
