import type { Note } from '@/music/types';
import type { ADSREnvelope, FMPreset } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet } from './voice-set';

export class FMSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  trigger(notes: Note[], adsr: ADSREnvelope, preset: FMPreset, when?: number, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    const count = Math.min(notes.length, 6);
    // Sine carriers have far less energy than saws, so they can run hotter.
    const level = voiceLevel(count) * 2;

    for (let i = 0; i < count; i++) {
      const note = notes[i];
      if (!note || !Number.isFinite(note.frequency)) continue;
      const start = now + i * spread;
      const pan = count > 1 ? -0.5 + (i / (count - 1)) : 0;

      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = note.frequency;

      const modulator = this.ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = note.frequency * preset.frequencyRatio;

      const modGain = this.ctx.createGain();
      modGain.gain.value = note.frequency * preset.modulationIndex;

      const envGain = this.ctx.createGain();
      applyAttack(envGain.gain, adsr, start, level);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(envGain);
      envGain.connect(panner);
      panner.connect(this.output);

      carrier.start(start);
      modulator.start(start);

      this.voices.add({ gains: [envGain.gain], sources: [carrier, modulator] });
    }
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
  }
}
