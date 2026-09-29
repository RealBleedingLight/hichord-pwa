import type { Note } from '@/music/types';
import type { ADSREnvelope } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet } from './voice-set';
import { DEFAULT_SHAPING, panFor, setPitch, type VoiceShaping } from './shaping';
import { zoneFor, type SampleSet } from './instruments';

export class SampleSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;
  private sampleCache: Map<string, AudioBuffer> = new Map();
  private shaping: VoiceShaping = DEFAULT_SHAPING;
  private lastMidis: number[] = [];

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
  }

  setShaping(shaping: VoiceShaping): void {
    this.shaping = shaping;
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

  /**
   * Plays each note from the instrument zone nearest to it, pitch-shifted
   * from that zone's root. Sustaining instruments loop while held.
   */
  trigger(notes: Note[], adsr: ADSREnvelope, set: SampleSet, when?: number, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    const playable = notes.filter((n) => n && Number.isFinite(n.midi)).slice(0, Math.min(6, this.shaping.maxNotes));
    const count = playable.length;
    // Samples are normalised mono, so give them the same headroom as two oscillators.
    const level = voiceLevel(count) * 2;
    const midis: number[] = [];
    const vibrato = this.shaping.vibrato;

    playable.forEach((note, i) => {
      const start = now + i * spread;
      const zone = zoneFor(set, note.midi);
      const source = this.ctx.createBufferSource();
      source.buffer = zone.buffer;
      if (set.loop) {
        source.loop = true;
        source.loopStart = set.loop.start;
        source.loopEnd = set.loop.end;
      }
      const rate = Math.pow(2, (note.midi - zone.rootMidi) / 12);
      const prev = this.lastMidis[i];
      const fromRate = prev === undefined ? undefined : Math.pow(2, (prev - zone.rootMidi) / 12);
      setPitch(source.playbackRate, rate, start, fromRate, this.shaping.glide);
      midis.push(note.midi);
      vibrato?.connect(source.detune);

      const envGain = this.ctx.createGain();
      applyAttack(envGain.gain, adsr, start, level);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = panFor(i, count, this.shaping.width);

      source.connect(envGain).connect(panner).connect(this.output);
      source.start(start);

      this.voices.add({
        gains: [envGain.gain],
        sources: [source],
        dispose: vibrato ? () => { try { vibrato.disconnect(source.detune); } catch { /* gone */ } } : undefined,
      });
    });
    this.lastMidis = midis;
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
  }
}
