/**
 * Per-voice sound shaping shared by the pitched synths: vibrato, glide
 * (portamento), stereo width and a cap on how many chord notes sound.
 */
export interface VoiceShaping {
  /** LFO output in cents, connected to each oscillator's detune (null = off). */
  vibrato: AudioNode | null;
  /** Glide time in seconds from the previous chord's pitches (0 = off). */
  glide: number;
  /** Stereo spread of chord notes, 0 (mono) – 1 (wide). */
  width: number;
  /** Maximum simultaneous chord notes (bass counts as a note). */
  maxNotes: number;
}

export const DEFAULT_SHAPING: VoiceShaping = { vibrato: null, glide: 0, width: 0.7, maxNotes: 6 };

/** Pan position for note `i` of `count`, spread by `width`. */
export function panFor(i: number, count: number, width: number): number {
  if (count <= 1) return 0;
  return (-1 + (2 * i) / (count - 1)) * 0.6 * width;
}

/** Sets `param` to `target`, gliding from `from` when glide is on. */
export function setPitch(param: AudioParam, target: number, when: number, from: number | undefined, glide: number): void {
  if (glide > 0 && from !== undefined && from > 0 && from !== target) {
    param.setValueAtTime(from, when);
    param.exponentialRampToValueAtTime(target, when + glide);
  } else {
    param.setValueAtTime(target, when);
  }
}

/** Retunes a sounding voice without re-attacking it. */
export function retune(param: AudioParam, target: number, when: number, glide: number): void {
  const p = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(when);
  else { param.cancelScheduledValues(when); param.setValueAtTime(param.value, when); }
  // A short exponential approach even with glide off, so the change doesn't click.
  param.setTargetAtTime(target, when, Math.max(0.004, glide / 4));
}
