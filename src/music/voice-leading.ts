import type { ChordVoicing, Inversion } from './types';
import { midiToFrequency, midiToNoteName } from './scales';

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Nearest midi pitch to `fromMidi` that shares the given pitch class. */
function nearestPitch(fromMidi: number, targetPc: number): number {
  let delta = (targetPc - pitchClass(fromMidi) + 12) % 12; // 0..11
  if (delta > 6) delta -= 12; // prefer the closer direction (down) past half an octave
  return fromMidi + delta;
}

function totalMovement(prev: number[], next: number[]): number {
  const len = Math.min(prev.length, next.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    total += Math.abs(prev[i]! - next[i]!);
  }
  return total;
}

function undoInversion(midis: number[], inv: Inversion): number[] {
  const notes = [...midis];
  for (let i = 0; i < inv; i++) {
    const highest = notes.pop()!;
    notes.unshift(highest - 12);
  }
  return notes;
}

function doInversion(midis: number[], inv: Inversion): number[] {
  const notes = [...midis];
  for (let i = 0; i < inv; i++) {
    const lowest = notes.shift()!;
    notes.push(lowest + 12);
  }
  return notes;
}

/**
 * Re-registers `candidate` (a rotated chord shape, any absolute octave) so
 * each voice sits at the pitch closest to the corresponding voice of `prev`,
 * i.e. the "nearest voicing" for that inversion shape.
 */
function voiceAgainst(prevMidis: number[], candidate: number[]): number[] {
  const result: number[] = [];
  let lastShift = 0;
  for (let i = 0; i < candidate.length; i++) {
    const midi = candidate[i]!;
    const reference = prevMidis[i];
    if (reference === undefined) {
      // No corresponding voice in prev (e.g. extending a triad to a 7th
      // chord) — carry the octave shift of the last voiced note forward.
      result.push(midi + lastShift);
      continue;
    }
    const voiced = nearestPitch(reference, pitchClass(midi));
    lastShift = voiced - midi;
    result.push(voiced);
  }
  return result;
}

/**
 * Picks whichever inversion of `next` requires the smallest total semitone
 * movement across all voices from `prev`, re-registering each voice to the
 * pitch nearest its counterpart in `prev` (smooth voice leading).
 */
export function selectVoiceLeading(
  prev: ChordVoicing,
  next: ChordVoicing,
): ChordVoicing {
  const prevMidis = prev.notes.map((n) => n.midi);
  const rootMidis = undoInversion(next.notes.map((n) => n.midi), next.inversion);

  let bestInversion: Inversion = 0;
  let bestVoiced: number[] = rootMidis;
  let bestMovement = Infinity;

  for (const inv of [0, 1, 2] as Inversion[]) {
    const candidate = doInversion(rootMidis, inv);
    const voiced = voiceAgainst(prevMidis, candidate);
    const movement = totalMovement(prevMidis, voiced);
    if (movement < bestMovement) {
      bestMovement = movement;
      bestInversion = inv;
      bestVoiced = voiced;
    }
  }

  return {
    ...next,
    notes: bestVoiced.map((midi) => ({
      midi,
      frequency: midiToFrequency(midi),
      name: midiToNoteName(midi),
      octave: Math.floor(midi / 12) - 1,
    })),
    inversion: bestInversion,
  };
}
