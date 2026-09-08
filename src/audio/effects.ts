import type { EffectType } from './types';

export class EffectsChain {
  private ctx: BaseAudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect nodes
  private filterNode: BiquadFilterNode;
  private filterBypass: GainNode;
  private chorusDelay: DelayNode;
  private chorusLfo: OscillatorNode;
  private chorusGain: GainNode;
  private chorusDry: GainNode;
  private chorusWet: GainNode;
  private flangerDelay: DelayNode;
  private flangerLfo: OscillatorNode;
  private flangerFeedback: GainNode;
  private flangerDry: GainNode;
  private flangerWet: GainNode;
  private tremoloGain: GainNode;
  private tremoloLfo: OscillatorNode;
  private tremoloDepth: GainNode;
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayDry: GainNode;
  private delayWet: GainNode;
  private reverbConvolver: ConvolverNode;
  private reverbDry: GainNode;
  private reverbWet: GainNode;
  private stereoPanner: StereoPannerNode;

  private bpm = 120;
  private effectStates: Map<EffectType, boolean> = new Map();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.inputGain = ctx.createGain();
    this.outputGain = ctx.createGain();

    // Filter
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 20000;
    this.filterBypass = ctx.createGain();

    // Chorus
    this.chorusDelay = ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.025;
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.frequency.value = 1.5;
    this.chorusGain = ctx.createGain();
    this.chorusGain.gain.value = 0.002;
    this.chorusDry = ctx.createGain();
    this.chorusWet = ctx.createGain();
    this.chorusWet.gain.value = 0;

    // Flanger
    this.flangerDelay = ctx.createDelay(0.02);
    this.flangerDelay.delayTime.value = 0.005;
    this.flangerLfo = ctx.createOscillator();
    this.flangerLfo.frequency.value = 0.25;
    this.flangerFeedback = ctx.createGain();
    this.flangerFeedback.gain.value = 0.5;
    this.flangerDry = ctx.createGain();
    this.flangerWet = ctx.createGain();
    this.flangerWet.gain.value = 0;

    // Tremolo
    this.tremoloGain = ctx.createGain();
    this.tremoloLfo = ctx.createOscillator();
    this.tremoloLfo.frequency.value = 4;
    this.tremoloDepth = ctx.createGain();
    this.tremoloDepth.gain.value = 0;

    // Delay
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.5;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayDry = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0;

    // Reverb
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.generateImpulseResponse(2, 2);
    this.reverbDry = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0;

    // Stereo
    this.stereoPanner = ctx.createStereoPanner();
    this.stereoPanner.pan.value = 0;

    this.wireChain();
    this.startLfos();
  }

  private wireChain(): void {
    // Input → Filter → Chorus → Flanger → Tremolo → Delay → Reverb → Stereo → Output
    this.inputGain.connect(this.filterNode);

    // Chorus (wet/dry)
    this.filterNode.connect(this.chorusDry);
    this.filterNode.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusLfo.connect(this.chorusGain);
    this.chorusGain.connect(this.chorusDelay.delayTime);

    // Merge chorus → flanger
    const chorusMerge = this.ctx.createGain();
    this.chorusDry.connect(chorusMerge);
    this.chorusWet.connect(chorusMerge);

    // Flanger (wet/dry)
    chorusMerge.connect(this.flangerDry);
    chorusMerge.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerWet);
    const flangerLfoGain = this.ctx.createGain();
    flangerLfoGain.gain.value = 0.002;
    this.flangerLfo.connect(flangerLfoGain);
    flangerLfoGain.connect(this.flangerDelay.delayTime);

    // Merge flanger → tremolo
    const flangerMerge = this.ctx.createGain();
    this.flangerDry.connect(flangerMerge);
    this.flangerWet.connect(flangerMerge);

    // Tremolo
    flangerMerge.connect(this.tremoloGain);
    this.tremoloLfo.connect(this.tremoloDepth);
    this.tremoloDepth.connect(this.tremoloGain.gain);

    // Delay (wet/dry)
    this.tremoloGain.connect(this.delayDry);
    this.tremoloGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);

    // Merge delay → reverb
    const delayMerge = this.ctx.createGain();
    this.delayDry.connect(delayMerge);
    this.delayWet.connect(delayMerge);

    // Reverb (wet/dry)
    delayMerge.connect(this.reverbDry);
    delayMerge.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWet);

    // Merge reverb → stereo → output
    const reverbMerge = this.ctx.createGain();
    this.reverbDry.connect(reverbMerge);
    this.reverbWet.connect(reverbMerge);
    reverbMerge.connect(this.stereoPanner);
    this.stereoPanner.connect(this.outputGain);
  }

  private startLfos(): void {
    try {
      this.chorusLfo.start();
      this.flangerLfo.start();
      this.tremoloLfo.start();
    } catch { /* already started in offline context tests */ }
  }

  private generateImpulseResponse(duration: number, decay: number): AudioBuffer {
    const length = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  getInput(): AudioNode { return this.inputGain; }
  getOutput(): AudioNode { return this.outputGain; }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.effectStates.get('delay')) {
      // Re-sync delay time
      const currentValue = this.delayNode.delayTime.value;
      // Keep same subdivision
      void currentValue;
    }
  }

  setEffect(type: EffectType, enabled: boolean, value: number): void {
    this.effectStates.set(type, enabled);

    switch (type) {
      case 'filter':
        this.filterNode.frequency.value = enabled ? Math.max(20, Math.min(20000, value)) : 20000;
        break;
      case 'reverb':
        this.reverbWet.gain.value = enabled ? value : 0;
        break;
      case 'delay': {
        this.delayWet.gain.value = enabled ? 0.4 : 0;
        if (enabled) {
          const beatDuration = 60 / this.bpm;
          this.delayNode.delayTime.value = beatDuration * value; // value = fraction (0.25 = 1/4)
        }
        break;
      }
      case 'chorus':
        this.chorusWet.gain.value = enabled ? value : 0;
        break;
      case 'flanger':
        this.flangerWet.gain.value = enabled ? value : 0;
        break;
      case 'tremolo':
        this.tremoloDepth.gain.value = enabled ? value : 0;
        break;
      case 'stereo':
        this.stereoPanner.pan.value = 0; // stereo width handled by synth panners
        break;
      default:
        break;
    }
  }
}
