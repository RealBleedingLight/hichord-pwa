import type { ChordVoicing } from '@/music/types';
import type { SynthMode, ADSREnvelope, AnalogWaveform, EffectType } from './types';
import { ADSR_PRESETS, FM_PRESETS } from './types';
import { AnalogSynth } from './synth-analog';
import { FMSynth } from './synth-fm';
import { SampleSynth } from './synth-sample';
import { NoiseSynth } from './synth-noise';
import { EffectsChain } from './effects';
import { INSTRUMENT_ROOT_MIDI, isBuiltinInstrument, renderInstrument } from './instruments';

/**
 * Independent voice pools. 'live' is what the player's hands trigger; 'seq'
 * is the chord sequencer — so a playing progression and live chords don't
 * cut each other off.
 */
export type VoiceGroup = 'live' | 'seq';

interface SynthSet {
  analog: AnalogSynth;
  fm: FMSynth;
  sample: SampleSynth;
  noise: NoiseSynth;
}

/**
 * Signal flow:
 *
 *   synths → effectsInput → EffectsChain ─┐
 *   drums  → drumBus ─────────────────────┼→ mixBus ─→ limiter → masterGain → destination
 *                                          │               ↑
 *                             (looper records mixBus)  looperReturn
 *
 * The looper taps the post-effects mix and plays back straight into the
 * limiter, so loops sound like what was played and aren't re-recorded.
 */
export class AudioEngine {
  private ctx: AudioContext | OfflineAudioContext;
  private masterGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private mixBus: GainNode;
  private drumBus: GainNode;
  private looperReturn: GainNode;
  private analyser: AnalyserNode;
  private effectsInput: GainNode;
  private effectsChain: EffectsChain;
  private groups = new Map<VoiceGroup, SynthSet>();
  private currentAdsr: ADSREnvelope = ADSR_PRESETS.TOUCH;
  private currentWaveform: AnalogWaveform = 'sawtooth';
  private currentSynthMode: SynthMode = 'analog';
  private currentFmPresetIndex = 0;
  private currentSampleBuffer: AudioBuffer | null = null;
  private currentSampleRootMidi = INSTRUMENT_ROOT_MIDI;
  private instrumentCache = new Map<string, AudioBuffer>();
  private micSample: { buffer: AudioBuffer; rootMidi: number } | null = null;

  constructor(offlineCtx?: OfflineAudioContext) {
    this.ctx = offlineCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.masterGain.connect(this.analyser);

    // Brick-wall-ish limiter: stops stacked chords + drums + loops from clipping.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.limiter.connect(this.masterGain);

    this.mixBus = this.ctx.createGain();
    this.mixBus.connect(this.limiter);

    this.looperReturn = this.ctx.createGain();
    this.looperReturn.connect(this.limiter);

    this.drumBus = this.ctx.createGain();
    this.drumBus.gain.value = 0.9;
    this.drumBus.connect(this.mixBus);

    this.effectsChain = new EffectsChain(this.ctx);
    this.effectsChain.connect(this.mixBus);
    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.effectsChain.getInput());

    this.group('live');
  }

  private group(name: VoiceGroup): SynthSet {
    let set = this.groups.get(name);
    if (!set) {
      set = {
        analog: new AnalogSynth(this.ctx, this.effectsInput),
        fm: new FMSynth(this.ctx, this.effectsInput),
        sample: new SampleSynth(this.ctx, this.effectsInput),
        noise: new NoiseSynth(this.ctx, this.effectsInput),
      };
      set.noise.init().catch(() => { /* AudioWorklet unavailable — noise mode stays silent */ });
      this.groups.set(name, set);
    }
    return set;
  }

  async resume(): Promise<void> {
    if (this.ctx instanceof AudioContext && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Plays a chord. `when` (AudioContext time) lets clock-driven modes schedule
   * sample-accurately; `spread` (seconds between notes) strums it.
   */
  triggerChord(voicing: ChordVoicing, when?: number, spread = 0, group: VoiceGroup = 'live'): void {
    const synths = this.group(group);
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    switch (this.currentSynthMode) {
      case 'analog':
        synths.analog.trigger(allNotes, this.currentAdsr, this.currentWaveform, when, spread);
        break;
      case 'fm':
        synths.fm.trigger(allNotes, this.currentAdsr, FM_PRESETS[this.currentFmPresetIndex] ?? FM_PRESETS[0]!, when, spread);
        break;
      case 'sample':
        if (this.currentSampleBuffer) {
          synths.sample.trigger(allNotes, this.currentAdsr, this.currentSampleBuffer, when, this.currentSampleRootMidi, spread);
        }
        break;
      case 'noise':
        synths.noise.trigger(this.currentAdsr, 'white', allNotes, when);
        break;
    }
  }

  releaseChord(when?: number, group: VoiceGroup = 'live'): void {
    const synths = this.group(group);
    switch (this.currentSynthMode) {
      case 'analog':
        synths.analog.release(this.currentAdsr, when);
        break;
      case 'fm':
        synths.fm.release(this.currentAdsr, when);
        break;
      case 'sample':
        synths.sample.release(this.currentAdsr, when);
        break;
      case 'noise':
        synths.noise.release(this.currentAdsr, when);
        break;
    }
  }

  /** Cuts every sounding voice (all synth types) in one group, or in all groups. */
  stopAll(group?: VoiceGroup): void {
    for (const [name, set] of this.groups) {
      if (group && name !== group) continue;
      set.analog.stop();
      set.fm.stop();
      set.sample.stop();
      set.noise.stop();
    }
  }

  setSynthMode(mode: SynthMode): void {
    if (mode !== this.currentSynthMode) this.stopAll();
    this.currentSynthMode = mode;
  }
  setWaveform(wf: AnalogWaveform): void { this.currentWaveform = wf; }
  setAdsr(adsr: ADSREnvelope): void { this.currentAdsr = adsr; }
  setFmPresetIndex(idx: number): void { this.currentFmPresetIndex = idx; }
  setSampleBuffer(buffer: AudioBuffer | null, rootMidi = INSTRUMENT_ROOT_MIDI): void {
    this.currentSampleBuffer = buffer;
    this.currentSampleRootMidi = rootMidi;
  }

  /** Selects a built-in instrument ('keys', 'pluck', …) or the captured mic sample ('mic'). */
  setSampleName(name: string): void {
    if (name === 'mic') {
      if (this.micSample) this.setSampleBuffer(this.micSample.buffer, this.micSample.rootMidi);
      return;
    }
    const id = isBuiltinInstrument(name) ? name : 'keys';
    let buffer = this.instrumentCache.get(id);
    if (!buffer) {
      buffer = renderInstrument(this.ctx, id);
      this.instrumentCache.set(id, buffer);
    }
    this.setSampleBuffer(buffer, INSTRUMENT_ROOT_MIDI);
  }

  /** Stores a mic recording as the 'mic' instrument; `rootMidi` is its detected pitch. */
  setMicSample(buffer: AudioBuffer, rootMidi: number): void {
    this.micSample = { buffer, rootMidi };
  }

  hasMicSample(): boolean { return this.micSample !== null; }

  setBpm(bpm: number): void { this.effectsChain.setBpm(bpm); }

  getSampleSynth(): SampleSynth { return this.group('live').sample; }
  getNoiseSynth(): NoiseSynth { return this.group('live').noise; }
  setMasterVolume(vol: number): void { this.masterGain.gain.value = vol; }
  getMasterVolume(): number { return this.masterGain.gain.value; }
  getContext(): BaseAudioContext { return this.ctx; }
  /** Input of the synth → effects path. */
  getOutputNode(): GainNode { return this.effectsInput; }
  /** Drums join the mix after the synth effects. */
  getDrumBus(): GainNode { return this.drumBus; }
  /** Post-effects mix of synths + drums (what the looper records). */
  getMixBus(): GainNode { return this.mixBus; }
  /** Where looper playback enters the output (post-mix, so it isn't re-recorded). */
  getLooperReturn(): GainNode { return this.looperReturn; }
  /** Metronome clicks go here: audible, but not recorded into loops. */
  getMonitorBus(): AudioNode { return this.limiter; }
  getAnalyser(): AnalyserNode { return this.analyser; }
  setEffect(type: EffectType, enabled: boolean, value: number): void {
    this.effectsChain.setEffect(type, enabled, value);
  }
  getEffectsChain(): EffectsChain { return this.effectsChain; }

  close(): void {
    this.stopAll();
    if (this.ctx instanceof AudioContext) void this.ctx.close().catch(() => {});
  }
}
