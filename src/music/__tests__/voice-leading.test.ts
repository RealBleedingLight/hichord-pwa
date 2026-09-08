import { describe, it, expect } from 'vitest';
import { selectVoiceLeading } from '@/music/voice-leading';
import { getDiatonicChord } from '@/music/chord-engine';

describe('voice leading', () => {
  it('picks inversion minimizing total semitone movement', () => {
    const prev = getDiatonicChord('C', 'major', 1, 4); // C4 E4 G4
    const next = getDiatonicChord('C', 'major', 4, 4); // F4 A4 C5
    const result = selectVoiceLeading(prev, next);
    // Second inversion of F (C4 F4 A4) is closest to C E G
    expect(result.inversion).toBe(2);
  });

  it('returns root position when it is already closest', () => {
    const prev = getDiatonicChord('C', 'major', 1, 4); // C E G
    const next = getDiatonicChord('C', 'major', 2, 4); // D F A
    const result = selectVoiceLeading(prev, next);
    // Root position D F A is already close
    expect(result.inversion).toBe(0);
  });
});
