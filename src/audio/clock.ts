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

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime;
    this.intervalId = setInterval(() => this.schedule(), this.scheduleInterval);
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

  private schedule(): void {
    if (!this.ctx || !this.running) return;
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      for (const cb of this.callbacks) {
        cb(this.nextStepTime, this.step);
      }
      this.step++;
      this.nextStepTime += this.getStepDuration();
    }
  }
}
