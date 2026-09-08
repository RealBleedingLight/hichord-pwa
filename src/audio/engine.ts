import type { ChordVoicing } from '@/music/types';
import type { SynthMode, ADSREnvelope, AnalogWaveform } from './types';
import { ADSR_PRESETS } from './types';
import { AnalogSynth } from './synth-analog';

export class AudioEngine {
  private ctx: AudioContext | OfflineAudioContext;
  private masterGain: GainNode;
  private effectsInput: GainNode;
  private analogSynth: AnalogSynth;
  private currentAdsr: ADSREnvelope = ADSR_PRESETS.TOUCH;
  private currentWaveform: AnalogWaveform = 'sawtooth';
  private currentSynthMode: SynthMode = 'analog';

  constructor(offlineCtx?: OfflineAudioContext) {
    this.ctx = offlineCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.masterGain);

    this.analogSynth = new AnalogSynth(this.ctx, this.effectsInput);
  }

  async resume(): Promise<void> {
    if (this.ctx instanceof AudioContext && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  triggerChord(voicing: ChordVoicing): void {
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    switch (this.currentSynthMode) {
      case 'analog':
        this.analogSynth.trigger(allNotes, this.currentAdsr, this.currentWaveform);
        break;
      // FM, sample, noise added in later tasks
    }
  }

  releaseChord(): void {
    switch (this.currentSynthMode) {
      case 'analog':
        this.analogSynth.release(this.currentAdsr);
        break;
    }
  }

  setSynthMode(mode: SynthMode): void { this.currentSynthMode = mode; }
  setWaveform(wf: AnalogWaveform): void { this.currentWaveform = wf; }
  setAdsr(adsr: ADSREnvelope): void { this.currentAdsr = adsr; }
  setMasterVolume(vol: number): void { this.masterGain.gain.value = vol; }
  getMasterVolume(): number { return this.masterGain.gain.value; }
  getContext(): BaseAudioContext { return this.ctx; }
  getOutputNode(): GainNode { return this.effectsInput; }
}
