import type { Note } from '@/music/types';
import type { ADSREnvelope } from './types';

interface SampleVoice {
  source: AudioBufferSourceNode;
  envGain: GainNode;
  panner: StereoPannerNode;
}

export class SampleSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private activeVoices: SampleVoice[] = [];
  private sampleCache: Map<string, AudioBuffer> = new Map();

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  async loadSample(url: string): Promise<AudioBuffer> {
    const cached = this.sampleCache.get(url);
    if (cached) return cached;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.sampleCache.set(url, audioBuffer);
    return audioBuffer;
  }

  loadSampleFromBuffer(name: string, buffer: AudioBuffer): void {
    this.sampleCache.set(name, buffer);
  }

  trigger(notes: Note[], adsr: ADSREnvelope, sampleBuffer: AudioBuffer): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;
    const baseMidi = 60; // assume samples recorded at C4

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      if (!note) continue;
      const pan = notes.length > 1 ? -0.5 + (i / (notes.length - 1)) : 0;

      const source = this.ctx.createBufferSource();
      source.buffer = sampleBuffer;
      source.playbackRate.value = Math.pow(2, (note.midi - baseMidi) / 12);

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0, now);
      envGain.gain.linearRampToValueAtTime(1, attackEnd);
      envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      source.connect(envGain).connect(panner).connect(this.output);
      source.start(now);

      this.activeVoices.push({ source, envGain, panner });
    }
  }

  release(adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    for (const voice of this.activeVoices) {
      voice.envGain.gain.cancelScheduledValues(now);
      voice.envGain.gain.setValueAtTime(voice.envGain.gain.value, now);
      voice.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.source.stop(releaseEnd + 0.01);
    }
    setTimeout(() => { this.activeVoices = []; }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.envGain.gain.setValueAtTime(0, now);
        voice.source.stop(now + 0.005);
      } catch { /* already stopped */ }
    }
    this.activeVoices = [];
  }
}
