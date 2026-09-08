import type { Note } from '@/music/types';
import type { ADSREnvelope, AnalogWaveform } from './types';

interface Voice {
  oscL: OscillatorNode;
  oscR: OscillatorNode;
  gainL: GainNode;
  gainR: GainNode;
  panL: StereoPannerNode;
  panR: StereoPannerNode;
}

export class AnalogSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: Voice[] = [];
  private activeVoices: Voice[] = [];

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  getVoiceCount(): number {
    return 6;
  }

  trigger(notes: Note[], adsr: ADSREnvelope, waveform: AnalogWaveform): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      if (!note) continue;
      const panValue = notes.length > 1
        ? -0.5 + (i / (notes.length - 1)) * 1.0
        : 0;

      const oscL = this.createOsc(note.frequency, waveform);
      const oscR = this.createOsc(note.frequency, waveform);
      oscR.detune.value = 5; // slight detune for stereo width

      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      const panL = this.createPanner(panValue - 0.15);
      const panR = this.createPanner(panValue + 0.15);

      // ADSR envelope
      gainL.gain.setValueAtTime(0, now);
      gainL.gain.linearRampToValueAtTime(1, attackEnd);
      gainL.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);
      gainR.gain.setValueAtTime(0, now);
      gainR.gain.linearRampToValueAtTime(1, attackEnd);
      gainR.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      oscL.connect(gainL).connect(panL).connect(this.output);
      oscR.connect(gainR).connect(panR).connect(this.output);

      oscL.start(now);
      oscR.start(now);

      this.activeVoices.push({ oscL, oscR, gainL, gainR, panL, panR });
    }
  }

  release(adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;

    for (const voice of this.activeVoices) {
      voice.gainL.gain.cancelScheduledValues(now);
      voice.gainL.gain.setValueAtTime(voice.gainL.gain.value, now);
      voice.gainL.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.gainR.gain.cancelScheduledValues(now);
      voice.gainR.gain.setValueAtTime(voice.gainR.gain.value, now);
      voice.gainR.gain.linearRampToValueAtTime(0, releaseEnd);

      voice.oscL.stop(releaseEnd + 0.01);
      voice.oscR.stop(releaseEnd + 0.01);
    }

    setTimeout(() => {
      this.activeVoices = [];
    }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.gainL.gain.cancelScheduledValues(now);
        voice.gainL.gain.setValueAtTime(0, now);
        voice.gainR.gain.cancelScheduledValues(now);
        voice.gainR.gain.setValueAtTime(0, now);
        voice.oscL.stop(now + 0.005);
        voice.oscR.stop(now + 0.005);
      } catch {
        // oscillator already stopped
      }
    }
    this.activeVoices = [];
  }

  private createOsc(frequency: number, waveform: AnalogWaveform): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = frequency;
    return osc;
  }

  private createPanner(pan: number): StereoPannerNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    return panner;
  }
}
