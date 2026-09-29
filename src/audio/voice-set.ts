import { applyCut, applyRelease } from './envelope';

export interface VoiceHandle {
  /** Envelope gain params to fade. */
  gains: AudioParam[];
  /** Nodes to stop once the voice is silent. */
  sources: AudioScheduledSourceNode[];
  /** Extra teardown (e.g. disconnecting a worklet node that never stops itself). */
  dispose?: () => void;
  releaseAt: number | null;
  endAt: number;
}

/**
 * Bookkeeping shared by the synths: which voices are sounding, which have a
 * release scheduled (possibly in the future, for clock-driven notes), and
 * when each can be torn down.
 */
export class VoiceSet {
  private voices: VoiceHandle[] = [];

  constructor(private ctx: BaseAudioContext) {}

  add(voice: Omit<VoiceHandle, 'releaseAt' | 'endAt'>): void {
    this.voices.push({ ...voice, releaseAt: null, endAt: Infinity });
  }

  /** Starts the release of every held voice at `when`. */
  release(releaseMs: number, when: number): void {
    this.prune();
    for (const v of this.voices) {
      if (v.releaseAt !== null) continue;
      let end = when;
      for (const g of v.gains) end = applyRelease(g, releaseMs, when);
      this.finish(v, when, end);
    }
  }

  /**
   * Quickly fades voices that would still be sounding at `when` — held ones,
   * and ones whose scheduled release hasn't started yet. Voices already in
   * their release tail are left to ring out naturally.
   */
  cut(when: number): void {
    this.prune();
    for (const v of this.voices) {
      if (v.releaseAt !== null && v.releaseAt <= when) continue;
      let end = when;
      for (const g of v.gains) end = applyCut(g, when);
      this.finish(v, when, end);
    }
  }

  heldCount(): number {
    return this.voices.filter((v) => v.releaseAt === null).length;
  }

  private finish(v: VoiceHandle, releaseAt: number, endAt: number): void {
    v.releaseAt = releaseAt;
    v.endAt = endAt;
    for (const s of v.sources) {
      try { s.stop(endAt); } catch { /* not started / already stopped */ }
    }
    if (v.dispose) {
      const dispose = v.dispose;
      v.dispose = undefined;
      const delayMs = Math.max(0, (endAt - this.ctx.currentTime) * 1000) + 50;
      setTimeout(dispose, delayMs);
    }
  }

  private prune(): void {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.endAt > now);
  }
}
