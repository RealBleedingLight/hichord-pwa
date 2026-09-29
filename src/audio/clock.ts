import type { ArpRate } from './types';

type TickCallback = (time: number, step: number) => void;

const RATE_DIVISORS: Record<ArpRate, number> = {
  '1/1': 4,
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
  '1/16T': 1 / 6,
  '1/32': 0.125,
  'swing8': 0.5,
  'swing16': 0.25,
};

export class MasterClock {
  private bpm = 120;
  private running = false;
  private step = 0;
  private nextStepTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TickCallback[] = [];
  private currentRate: ArpRate = '1/8';
  /** Fraction of a step that every odd step is delayed by (0 = straight). */
  private swing = 0;
  private ctx: BaseAudioContext | null = null;

  private scheduleAhead = 0.1; // 100ms lookahead
  private scheduleInterval = 25; // check every 25ms

  constructor(ctx?: BaseAudioContext) {
    this.ctx = ctx ?? null;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(300, bpm));
  }

  getBpm(): number { return this.bpm; }

  setRate(rate: ArpRate): void { this.currentRate = rate; }

  /**
   * Straight = 0; 1/3 gives the classic triplet shuffle (long-short pairs).
   * The swing8/swing16 rates imply 1/3 on their own.
   */
  setSwing(amount: number): void { this.swing = Math.max(0, Math.min(0.5, amount)); }

  private swingAmount(): number {
    if (this.currentRate === 'swing8' || this.currentRate === 'swing16') return Math.max(this.swing, 1 / 3);
    return this.swing;
  }

  setContext(ctx: BaseAudioContext): void { this.ctx = ctx; }

  getStepDuration(rate?: ArpRate): number {
    const r = rate ?? this.currentRate;
    const beatDuration = 60 / this.bpm;
    return beatDuration * RATE_DIVISORS[r];
  }

  onTick(callback: TickCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Starts ticking. `startAt` (AudioContext time) and `startStep` let callers
   * line the first tick up with an existing bar grid (e.g. a running loop).
   */
  start(startAt?: number, startStep = 0): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.step = startStep;
    this.nextStepTime = Math.max(startAt ?? 0, this.ctx.currentTime);
    this.intervalId = setInterval(() => this.schedule(), this.scheduleInterval);
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.step = 0;
  }

  isRunning(): boolean { return this.running; }

  getCurrentStep(): number { return this.step; }

  private schedule(): void {
    if (!this.ctx || !this.running) return;
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      const offset = this.step % 2 === 1 ? this.swingAmount() * this.getStepDuration() : 0;
      for (const cb of this.callbacks) {
        cb(this.nextStepTime + offset, this.step);
      }
      this.step++;
      this.nextStepTime += this.getStepDuration();
    }
  }
}
