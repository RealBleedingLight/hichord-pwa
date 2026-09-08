import type { ADSREnvelope } from './types';
import { getNoiseWorkletUrl } from './noise-worklet';

export class NoiseSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private noiseNode: AudioWorkletNode | null = null;
  private envGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private initialized = false;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  async init(): Promise<void> {
    if (this.initialized || !(this.ctx instanceof AudioContext)) return;
    const url = getNoiseWorkletUrl();
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.initialized = true;
  }

  trigger(adsr: ADSREnvelope, type: 'white' | 'pink' | 'filtered' | 'metallic'): void {
    this.stop();
    if (!(this.ctx instanceof AudioContext) || !this.initialized) return;

    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    this.noiseNode = new AudioWorkletNode(this.ctx, 'noise-processor');
    this.noiseNode.port.postMessage({ type: type === 'filtered' || type === 'metallic' ? 'white' : type });

    this.envGain = this.ctx.createGain();
    this.envGain.gain.setValueAtTime(0, now);
    this.envGain.gain.linearRampToValueAtTime(1, attackEnd);
    this.envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

    if (type === 'filtered' || type === 'metallic') {
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = type === 'metallic' ? 'bandpass' : 'lowpass';
      this.filter.frequency.value = type === 'metallic' ? 3000 : 1000;
      this.filter.Q.value = type === 'metallic' ? 10 : 1;
      this.noiseNode.connect(this.filter).connect(this.envGain).connect(this.output);
    } else {
      this.noiseNode.connect(this.envGain).connect(this.output);
    }
  }

  release(adsr: ADSREnvelope): void {
    if (!this.envGain || !this.noiseNode) return;
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    this.envGain.gain.cancelScheduledValues(now);
    this.envGain.gain.setValueAtTime(this.envGain.gain.value, now);
    this.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
    const node = this.noiseNode;
    setTimeout(() => { try { node.disconnect(); } catch { /* already disconnected */ } }, adsr.release + 50);
  }

  stop(): void {
    try { this.noiseNode?.disconnect(); } catch { /* already disconnected */ }
    try { this.envGain?.disconnect(); } catch { /* already disconnected */ }
    try { this.filter?.disconnect(); } catch { /* already disconnected */ }
    this.noiseNode = null;
    this.envGain = null;
    this.filter = null;
  }
}
