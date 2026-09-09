import type { Note } from '@/music/types';
import type { ADSREnvelope, FMPreset } from './types';

interface FMVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  envGain: GainNode;
  panner: StereoPannerNode;
}

export class FMSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private activeVoices: FMVoice[] = [];

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  trigger(notes: Note[], adsr: ADSREnvelope, preset: FMPreset): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      if (!note) continue;
      const pan = notes.length > 1 ? -0.5 + (i / (notes.length - 1)) : 0;

      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = note.frequency;

      const modulator = this.ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = note.frequency * preset.frequencyRatio;

      const modGain = this.ctx.createGain();
      modGain.gain.value = note.frequency * preset.modulationIndex;

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0, now);
      envGain.gain.linearRampToValueAtTime(1, attackEnd);
      envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(envGain);
      envGain.connect(panner);
      panner.connect(this.output);

      carrier.start(now);
      modulator.start(now);

      this.activeVoices.push({ carrier, modulator, modGain, envGain, panner });
    }
  }

  release(adsr: ADSREnvelope): void {
    const releasingVoices = [...this.activeVoices];
    this.activeVoices = [];

    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    for (const voice of releasingVoices) {
      voice.envGain.gain.cancelScheduledValues(now);
      voice.envGain.gain.setValueAtTime(voice.envGain.gain.value, now);
      voice.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.carrier.stop(releaseEnd + 0.01);
      voice.modulator.stop(releaseEnd + 0.01);
    }
    setTimeout(() => { releasingVoices.length = 0; }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.envGain.gain.cancelScheduledValues(now);
        voice.envGain.gain.setValueAtTime(0, now);
        voice.carrier.stop(now + 0.005);
        voice.modulator.stop(now + 0.005);
      } catch { /* already stopped */ }
    }
    this.activeVoices = [];
  }
}
