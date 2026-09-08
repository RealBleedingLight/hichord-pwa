import type { ChordVoicing } from '@/music/types';
import type { SynthMode, ADSREnvelope, AnalogWaveform, EffectType } from './types';
import { ADSR_PRESETS, FM_PRESETS } from './types';
import { AnalogSynth } from './synth-analog';
import { FMSynth } from './synth-fm';
import { SampleSynth } from './synth-sample';
import { NoiseSynth } from './synth-noise';
import { EffectsChain } from './effects';

export class AudioEngine {
  private ctx: AudioContext | OfflineAudioContext;
  private masterGain: GainNode;
  private effectsInput: GainNode;
  private effectsChain: EffectsChain;
  private analogSynth: AnalogSynth;
  private fmSynth: FMSynth;
  private sampleSynth: SampleSynth;
  private noiseSynth: NoiseSynth;
  private currentAdsr: ADSREnvelope = ADSR_PRESETS.TOUCH;
  private currentWaveform: AnalogWaveform = 'sawtooth';
  private currentSynthMode: SynthMode = 'analog';
  private currentFmPresetIndex = 0;
  private currentSampleBuffer: AudioBuffer | null = null;

  constructor(offlineCtx?: OfflineAudioContext) {
    this.ctx = offlineCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.effectsChain = new EffectsChain(this.ctx);
    this.effectsChain.connect(this.masterGain);
    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.effectsChain.getInput());

    this.analogSynth = new AnalogSynth(this.ctx, this.effectsInput);
    this.fmSynth = new FMSynth(this.ctx, this.effectsInput);
    this.sampleSynth = new SampleSynth(this.ctx, this.effectsInput);
    this.noiseSynth = new NoiseSynth(this.ctx, this.effectsInput);
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
      case 'fm':
        this.fmSynth.trigger(allNotes, this.currentAdsr, FM_PRESETS[this.currentFmPresetIndex] ?? FM_PRESETS[0]!);
        break;
      case 'sample':
        if (this.currentSampleBuffer) {
          this.sampleSynth.trigger(allNotes, this.currentAdsr, this.currentSampleBuffer);
        }
        break;
      case 'noise':
        this.noiseSynth.trigger(this.currentAdsr, 'white');
        break;
    }
  }

  releaseChord(): void {
    switch (this.currentSynthMode) {
      case 'analog':
        this.analogSynth.release(this.currentAdsr);
        break;
      case 'fm':
        this.fmSynth.release(this.currentAdsr);
        break;
      case 'sample':
        this.sampleSynth.release(this.currentAdsr);
        break;
      case 'noise':
        this.noiseSynth.release(this.currentAdsr);
        break;
    }
  }

  setSynthMode(mode: SynthMode): void { this.currentSynthMode = mode; }
  setWaveform(wf: AnalogWaveform): void { this.currentWaveform = wf; }
  setAdsr(adsr: ADSREnvelope): void { this.currentAdsr = adsr; }
  setFmPresetIndex(idx: number): void { this.currentFmPresetIndex = idx; }
  setSampleBuffer(buffer: AudioBuffer | null): void { this.currentSampleBuffer = buffer; }
  getSampleSynth(): SampleSynth { return this.sampleSynth; }
  getNoiseSynth(): NoiseSynth { return this.noiseSynth; }
  setMasterVolume(vol: number): void { this.masterGain.gain.value = vol; }
  getMasterVolume(): number { return this.masterGain.gain.value; }
  getContext(): BaseAudioContext { return this.ctx; }
  getOutputNode(): GainNode { return this.effectsInput; }
  setEffect(type: EffectType, enabled: boolean, value: number): void {
    this.effectsChain.setEffect(type, enabled, value);
  }
  getEffectsChain(): EffectsChain { return this.effectsChain; }
}
