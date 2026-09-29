import type { ADSREnvelope } from './types';

/**
 * Per-oscillator peak level for a chord of `noteCount` notes. Scales down as
 * notes are added so a 6-note chord doesn't sum to 6× full scale and clip.
 */
export function voiceLevel(noteCount: number): number {
  return 0.35 / Math.sqrt(Math.max(1, noteCount));
}

/** Schedules the attack/decay/sustain stages of an envelope starting at `when`. */
export function applyAttack(param: AudioParam, adsr: ADSREnvelope, when: number, peak: number): void {
  const attackEnd = when + Math.max(1, adsr.attack) / 1000;
  const decayEnd = attackEnd + Math.max(1, adsr.decay) / 1000;
  param.setValueAtTime(0, when);
  param.linearRampToValueAtTime(peak, attackEnd);
  param.linearRampToValueAtTime(peak * adsr.sustain, decayEnd);
}

/** Holds the param's value at `when`, dropping any automation scheduled after it. */
function holdAt(param: AudioParam, when: number): void {
  const p = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof p.cancelAndHoldAtTime === 'function') {
    p.cancelAndHoldAtTime(when);
  } else {
    param.cancelScheduledValues(when);
    param.setValueAtTime(param.value, when);
  }
}

/**
 * Fades the param to silence over roughly `releaseMs`, starting at `when`.
 * Returns the time by which the voice is inaudible and can be stopped.
 */
export function applyRelease(param: AudioParam, releaseMs: number, when: number): number {
  const seconds = Math.max(5, releaseMs) / 1000;
  holdAt(param, when);
  // setTargetAtTime is exponential: ~99% of the way there after 5 time constants.
  param.setTargetAtTime(0, when, seconds / 5);
  return when + seconds + 0.05;
}

/** Very short fade used when a new chord cuts off the previous one (avoids clicks). */
export function applyCut(param: AudioParam, when: number): number {
  holdAt(param, when);
  param.setTargetAtTime(0, when, 0.004);
  return when + 0.03;
}

/** Click-free parameter change (a ~15 ms glide instead of a jump). */
export function smoothSet(param: AudioParam, value: number, ctx: BaseAudioContext): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(value, now, 0.015);
}
