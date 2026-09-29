import type { Note } from '@/music/types';
import type { ADSREnvelope, FMPreset } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet, type VoiceHandle } from './voice-set';
import { DEFAULT_SHAPING, panFor, retune, setPitch, type VoiceShaping } from './shaping';

interface HeldVoice {
  handle: VoiceHandle;
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  panner: StereoPannerNode;
  frequency: number;
}

export class FMSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;
  private shaping: VoiceShaping = DEFAULT_SHAPING;
  private held: HeldVoice[] = [];
  private lastFreqs: number[] = [];
  private preset: FMPreset | null = null;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  setShaping(shaping: VoiceShaping): void {
    this.shaping = shaping;
  }

  trigger(notes: Note[], adsr: ADSREnvelope, preset: FMPreset, when?: number, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    this.preset = preset;
    const playable = this.limit(notes);
    // Sine carriers have far less energy than saws, so they can run hotter.
    const level = voiceLevel(playable.length) * 2;
    const prev = this.lastFreqs;
    this.held = playable.map((note, i) =>
      this.startVoice(note.frequency, i, playable.length, adsr, now + i * spread, level, prev[i]));
    this.lastFreqs = playable.map((n) => n.frequency);
  }

  /** Changes the held chord without re-attacking (see AnalogSynth.morph). */
  morph(notes: Note[], adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const playable = this.limit(notes);
    if (!this.preset || this.held.length === 0 || this.voices.heldCount() === 0) {
      if (this.preset) this.trigger(playable, adsr, this.preset);
      return;
    }
    const level = voiceLevel(playable.length) * 2;
    const next: HeldVoice[] = [];
    playable.forEach((note, i) => {
      const v = this.held[i];
      if (v) {
        if (v.frequency !== note.frequency) {
          const glide = this.shaping.glide;
          retune(v.carrier.frequency, note.frequency, now, glide);
          retune(v.modulator.frequency, note.frequency * this.preset!.frequencyRatio, now, glide);
          retune(v.modGain.gain, note.frequency * this.preset!.modulationIndex, now, glide);
          v.frequency = note.frequency;
        }
        v.panner.pan.value = panFor(i, playable.length, this.shaping.width);
        next.push(v);
      } else {
        const fadeIn = { ...adsr, attack: Math.max(adsr.attack, 15) };
        next.push(this.startVoice(note.frequency, i, playable.length, fadeIn, now, level, this.lastFreqs[i]));
      }
    });
    for (const extra of this.held.slice(playable.length)) this.voices.cutVoice(extra.handle, now);
    this.held = next;
    this.lastFreqs = playable.map((n) => n.frequency);
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
    this.held = [];
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
    this.held = [];
  }

  private limit(notes: Note[]): Note[] {
    return notes.filter((n) => n && Number.isFinite(n.frequency)).slice(0, Math.min(6, this.shaping.maxNotes));
  }

  private startVoice(freq: number, i: number, count: number, adsr: ADSREnvelope, start: number, level: number, from?: number): HeldVoice {
    const preset = this.preset!;
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    setPitch(carrier.frequency, freq, start, from, this.shaping.glide);

    const modulator = this.ctx.createOscillator();
    modulator.type = 'sine';
    setPitch(modulator.frequency, freq * preset.frequencyRatio, start, from ? from * preset.frequencyRatio : undefined, this.shaping.glide);

    const modGain = this.ctx.createGain();
    modGain.gain.value = freq * preset.modulationIndex;

    const envGain = this.ctx.createGain();
    applyAttack(envGain.gain, adsr, start, level);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = panFor(i, count, this.shaping.width);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(envGain);
    envGain.connect(panner);
    panner.connect(this.output);

    const vibrato = this.shaping.vibrato;
    if (vibrato) {
      vibrato.connect(carrier.detune);
      vibrato.connect(modulator.detune);
    }

    carrier.start(start);
    modulator.start(start);

    const handle = this.voices.add({
      gains: [envGain.gain],
      sources: [carrier, modulator],
      dispose: vibrato ? () => {
        try { vibrato.disconnect(carrier.detune); vibrato.disconnect(modulator.detune); } catch { /* gone */ }
      } : undefined,
    });
    return { handle, carrier, modulator, modGain, panner, frequency: freq };
  }
}
