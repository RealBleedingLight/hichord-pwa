// Band-pass filter bank vocoder. A mic ("modulator") signal is split into
// bands; the envelope of each band is used to control the amplitude of the
// matching band of a synth ("carrier") signal, producing the classic
// robotic-voice vocoder effect.

/** Log-spaced band center frequencies spanning [minFreq, maxFreq]. */
export function computeBandFrequencies(numBands: number, minFreq = 100, maxFreq = 8000): number[] {
  if (numBands <= 0) return [];
  if (numBands === 1) return [Math.sqrt(minFreq * maxFreq)];

  const logMin = Math.log(minFreq);
  const logMax = Math.log(maxFreq);
  const bands: number[] = [];
  for (let i = 0; i < numBands; i++) {
    const t = i / (numBands - 1);
    bands.push(Math.exp(logMin + t * (logMax - logMin)));
  }
  return bands;
}

/** Shifts a set of band frequencies by the given number of semitones. */
export function applyFormantShift(freqs: number[], semitones: number): number[] {
  const ratio = Math.pow(2, semitones / 12);
  return freqs.map((f) => f * ratio);
}

interface VocoderBand {
  micFilter: BiquadFilterNode;
  synthFilter: BiquadFilterNode;
  rectifier: WaveShaperNode;
  envFollower: BiquadFilterNode;
  gate: WaveShaperNode;
  carrierGain: GainNode;
}

const CURVE_SIZE = 512;
const ENVELOPE_SMOOTHING_HZ = 20;
const BAND_Q = 4;

export class Vocoder {
  private ctx: BaseAudioContext;
  private numBands: number;
  private baseFrequencies: number[];
  private bands: VocoderBand[] = [];
  private micInput: GainNode;
  private synthInput: GainNode;
  private output: GainNode;
  private enabled = false;
  private formantShiftSemitones = 0;
  private gateThreshold = 0;

  constructor(ctx: BaseAudioContext, numBands = 12) {
    this.ctx = ctx;
    this.numBands = Math.max(1, numBands);
    this.baseFrequencies = computeBandFrequencies(this.numBands);

    this.micInput = ctx.createGain();
    this.synthInput = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = 0; // disabled until enable() is called

    this.buildBands();
  }

  private buildBands(): void {
    const rectifierCurve = this.makeRectifierCurve();

    for (const freq of this.baseFrequencies) {
      const micFilter = this.ctx.createBiquadFilter();
      micFilter.type = 'bandpass';
      micFilter.frequency.value = freq;
      micFilter.Q.value = BAND_Q;

      const rectifier = this.ctx.createWaveShaper();
      rectifier.curve = rectifierCurve;

      const envFollower = this.ctx.createBiquadFilter();
      envFollower.type = 'lowpass';
      envFollower.frequency.value = ENVELOPE_SMOOTHING_HZ;

      const gate = this.ctx.createWaveShaper();
      gate.curve = this.makeGateCurve(this.gateThreshold);

      const synthFilter = this.ctx.createBiquadFilter();
      synthFilter.type = 'bandpass';
      synthFilter.frequency.value = freq;
      synthFilter.Q.value = BAND_Q;

      const carrierGain = this.ctx.createGain();
      carrierGain.gain.value = 0;

      // Analysis (modulator) chain: mic -> band filter -> rectify -> smooth -> gate -> control signal
      this.micInput.connect(micFilter);
      micFilter.connect(rectifier);
      rectifier.connect(envFollower);
      envFollower.connect(gate);
      gate.connect(carrierGain.gain);

      // Synthesis (carrier) chain: synth -> band filter -> gain (modulated by envelope) -> output
      this.synthInput.connect(synthFilter);
      synthFilter.connect(carrierGain);
      carrierGain.connect(this.output);

      this.bands.push({ micFilter, synthFilter, rectifier, envFollower, gate, carrierGain });
    }
  }

  private makeRectifierCurve(): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(CURVE_SIZE);
    for (let i = 0; i < CURVE_SIZE; i++) {
      const x = (i / (CURVE_SIZE - 1)) * 2 - 1;
      curve[i] = Math.abs(x);
    }
    return curve;
  }

  private makeGateCurve(threshold: number): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(CURVE_SIZE);
    for (let i = 0; i < CURVE_SIZE; i++) {
      // Rectified envelope input ranges roughly 0..1.
      const x = i / (CURVE_SIZE - 1);
      curve[i] = x < threshold ? 0 : x;
    }
    return curve;
  }

  /** Connects a live mic stream as the vocoder's modulator input. */
  connectMicSource(stream: MediaStream): MediaStreamAudioSourceNode {
    const ctx = this.ctx as AudioContext;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(this.micInput);
    return source;
  }

  /** Connects a synth output node as the vocoder's carrier input. */
  connectSynthSource(source: AudioNode): void {
    source.connect(this.synthInput);
  }

  /**
   * Shifts the carrier (synth) band filters up/down in semitones, which
   * moves the formants without affecting the analysis of the mic input.
   */
  setFormantShift(semitones: number): void {
    this.formantShiftSemitones = semitones;
    const shifted = applyFormantShift(this.baseFrequencies, semitones);
    this.bands.forEach((band, i) => {
      band.synthFilter.frequency.value = shifted[i]!;
    });
  }

  getFormantShift(): number {
    return this.formantShiftSemitones;
  }

  /** Sets the noise-gate threshold (0..1) below which a band is muted. */
  setGateThreshold(threshold: number): void {
    this.gateThreshold = Math.max(0, Math.min(1, threshold));
    const curve = this.makeGateCurve(this.gateThreshold);
    // Some WaveShaperNode implementations disallow reassigning `curve`
    // after it has been set once, so the gate node is rebuilt instead.
    for (const band of this.bands) {
      band.gate.disconnect();
      band.envFollower.disconnect(band.gate);
      const newGate = this.ctx.createWaveShaper();
      newGate.curve = curve;
      band.envFollower.connect(newGate);
      newGate.connect(band.carrierGain.gain);
      band.gate = newGate;
    }
  }

  getGateThreshold(): number {
    return this.gateThreshold;
  }

  enable(): void {
    this.enabled = true;
    this.output.gain.value = 1;
  }

  disable(): void {
    this.enabled = false;
    this.output.gain.value = 0;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getOutput(): AudioNode {
    return this.output;
  }

  getBandFrequencies(): number[] {
    return [...this.baseFrequencies];
  }
}
