import type { Note } from '@/music/types';
import type { ADSREnvelope, AnalogWaveform } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet } from './voice-set';

export class AnalogSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  getVoiceCount(): number {
    return 6;
  }

  /**
   * Plays `notes` at `when` (default: now), cutting whatever this synth was
   * holding. `spread` staggers note starts in seconds (strum).
   */
  trigger(notes: Note[], adsr: ADSREnvelope, waveform: AnalogWaveform, when?: number, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    const count = Math.min(notes.length, 6);
    const level = voiceLevel(count);

    for (let i = 0; i < count; i++) {
      const note = notes[i];
      if (!note || !Number.isFinite(note.frequency)) continue;
      const start = now + i * spread;
      const panValue = count > 1 ? -0.5 + (i / (count - 1)) * 1.0 : 0;

      const oscL = this.createOsc(note.frequency, waveform);
      const oscR = this.createOsc(note.frequency, waveform);
      oscR.detune.value = 5; // slight detune for stereo width

      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      applyAttack(gainL.gain, adsr, start, level);
      applyAttack(gainR.gain, adsr, start, level);

      oscL.connect(gainL).connect(this.createPanner(panValue - 0.15)).connect(this.output);
      oscR.connect(gainR).connect(this.createPanner(panValue + 0.15)).connect(this.output);

      oscL.start(start);
      oscR.start(start);

      this.voices.add({ gains: [gainL.gain, gainR.gain], sources: [oscL, oscR] });
    }
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
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
