import type { Note } from '@/music/types';
import type { ADSREnvelope } from './types';
import { applyAttack, voiceLevel } from './envelope';
import { VoiceSet } from './voice-set';

export class SampleSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: VoiceSet;
  private sampleCache: Map<string, AudioBuffer> = new Map();

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.voices = new VoiceSet(ctx);
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
   * Plays `sampleBuffer` once per note, pitch-shifted from `rootMidi` (the
   * pitch the sample was recorded at) to each note.
   */
  trigger(notes: Note[], adsr: ADSREnvelope, sampleBuffer: AudioBuffer, when?: number, rootMidi = 60, spread = 0): void {
    const now = Math.max(when ?? 0, this.ctx.currentTime);
    this.voices.cut(now);
    const count = Math.min(notes.length, 6);
    // Samples are normalised mono, so give them the same headroom as two oscillators.
    const level = voiceLevel(count) * 2;

    for (let i = 0; i < count; i++) {
      const note = notes[i];
      if (!note || !Number.isFinite(note.midi)) continue;
      const start = now + i * spread;
      const pan = count > 1 ? -0.5 + (i / (count - 1)) : 0;

      const source = this.ctx.createBufferSource();
      source.buffer = sampleBuffer;
      source.playbackRate.value = Math.pow(2, (note.midi - rootMidi) / 12);

      const envGain = this.ctx.createGain();
      applyAttack(envGain.gain, adsr, start, level);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      source.connect(envGain).connect(panner).connect(this.output);
      source.start(start);

      this.voices.add({ gains: [envGain.gain], sources: [source] });
    }
  }

  release(adsr: ADSREnvelope, when?: number): void {
    this.voices.release(adsr.release, Math.max(when ?? 0, this.ctx.currentTime));
  }

  stop(when?: number): void {
    this.voices.cut(Math.max(when ?? 0, this.ctx.currentTime));
  }
}
