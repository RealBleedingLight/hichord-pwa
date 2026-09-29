import type { Note } from '@/music/types';
import type { ADSREnvelope, AnalogWaveform } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet, type VoiceHandle } from './voice-set';
import { DEFAULT_SHAPING, panFor, retune, setPitch, type VoiceShaping } from './shaping';

interface HeldVoice {
  handle: VoiceHandle;
  freqs: AudioParam[];
  pans: StereoPannerNode[];
  frequency: number;
}

export class AnalogSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;
  private shaping: VoiceShaping = DEFAULT_SHAPING;
  private held: HeldVoice[] = [];
  private lastFreqs: number[] = [];
  private waveform: AnalogWaveform = 'sawtooth';

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  getVoiceCount(): number {
    return 6;
  }

  setShaping(shaping: VoiceShaping): void {
    this.shaping = shaping;
  }

  /**
   * Plays `notes` at `when` (default: now), cutting whatever this synth was
   * holding. `spread` staggers note starts in seconds (strum).
   */
  trigger(notes: Note[], adsr: ADSREnvelope, waveform: AnalogWaveform, when?: number, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    this.held = [];
    this.waveform = waveform;
    const playable = this.limit(notes);
    const level = voiceLevel(playable.length);
    const prev = this.lastFreqs;
    this.held = playable.map((note, i) =>
      this.startVoice(note.frequency, i, playable.length, adsr, now + i * spread, level, prev[i]));
    this.lastFreqs = playable.map((n) => n.frequency);
  }

  /**
   * Changes the held chord to `notes` without re-attacking: voices retune
   * (gliding if glide is on), extra notes fade in, missing ones fade out.
   * Falls back to trigger() when nothing is held.
   */
  morph(notes: Note[], adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const playable = this.limit(notes);
    if (this.held.length === 0 || this.voices.heldCount() === 0) {
      this.trigger(playable, adsr, this.waveform);
      return;
    }
    const level = voiceLevel(playable.length);
    const next: HeldVoice[] = [];
    playable.forEach((note, i) => {
      const voice = this.held[i];
      if (voice) {
        if (voice.frequency !== note.frequency) {
          for (const f of voice.freqs) retune(f, note.frequency, now, this.shaping.glide);
          voice.frequency = note.frequency;
        }
        voice.pans.forEach((p, k) => { p.pan.value = this.panValue(i, playable.length, k); });
        next.push(voice);
      } else {
        // New note joins with a short fade so it doesn't pop in.
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

  private panValue(i: number, count: number, side: number): number {
    const base = panFor(i, count, this.shaping.width);
    const offset = 0.2 * this.shaping.width * (side === 0 ? -1 : 1);
    return Math.max(-1, Math.min(1, base + offset));
  }

  private startVoice(freq: number, i: number, count: number, adsr: ADSREnvelope, start: number, level: number, from?: number): HeldVoice {
    const oscs = [0, 1].map((side) => {
      const osc = this.ctx.createOscillator();
      osc.type = this.waveform;
      setPitch(osc.frequency, freq, start, from, this.shaping.glide);
      if (side === 1) osc.detune.value = 5; // slight detune for stereo width
      return osc;
    });
    const gains = oscs.map(() => this.ctx.createGain());
    const pans = oscs.map((_, side) => {
      const p = this.ctx.createStereoPanner();
      p.pan.value = this.panValue(i, count, side);
      return p;
    });
    const vibrato = this.shaping.vibrato;
    oscs.forEach((osc, k) => {
      applyAttack(gains[k]!.gain, adsr, start, level);
      osc.connect(gains[k]!).connect(pans[k]!).connect(this.output);
      vibrato?.connect(osc.detune);
      osc.start(start);
    });
    const handle = this.voices.add({
      gains: gains.map((g) => g.gain),
      sources: oscs,
      dispose: vibrato ? () => { for (const o of oscs) { try { vibrato.disconnect(o.detune); } catch { /* gone */ } } } : undefined,
    });
    return { handle, freqs: oscs.map((o) => o.frequency), pans, frequency: freq };
  }
}
