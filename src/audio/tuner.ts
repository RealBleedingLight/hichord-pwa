// Real-time chromatic tuner: analyses a mic MediaStream and reports the
// detected note name + cents deviation via a callback.
import { autocorrelate, frequencyToNote } from './pitch-detection';

export type PitchCallback = (note: string, cents: number) => void;

const FFT_SIZE = 2048;

export class Tuner {
  private ctx: AudioContext;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private callbacks: PitchCallback[] = [];
  private rafId: number | null = null;
  private running = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Begins pitch detection on the given mic stream. */
  start(stream: MediaStream): void {
    this.stream = stream;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.running = true;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const raf: (cb: () => void) => number =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 33) as unknown as number;
    this.rafId = raf(this.tick);
  }

  private tick = (): void => {
    if (!this.running || !this.analyser) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    this.processBuffer(buffer);
    this.scheduleNext();
  };

  /**
   * Runs pitch detection on a raw time-domain buffer and invokes registered
   * callbacks. Exposed separately from the rAF loop so it can be unit
   * tested with synthetic data.
   */
  processBuffer(buffer: Float32Array): void {
    const freq = autocorrelate(buffer, this.ctx.sampleRate);
    if (freq <= 0) return;
    const { note, cents } = frequencyToNote(freq);
    for (const cb of this.callbacks) cb(note, cents);
  }

  /** Stops analysis and releases the mic stream. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId as unknown as ReturnType<typeof setTimeout>);
      }
      this.rafId = null;
    }
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.analyser = null;
    this.source = null;
    this.stream = null;
  }

  onPitchDetected(cb: PitchCallback): void {
    this.callbacks.push(cb);
  }

  isRunning(): boolean {
    return this.running;
  }
}
