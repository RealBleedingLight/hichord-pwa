import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, SEQUENCE_SLOTS } from '@/store';
import { getPatternsForGenre } from '@/data/drum-patterns';

describe('beat + sequence state', () => {
  beforeEach(() => {
    useAppStore.getState().selectBeat('Rock', 0);
    useAppStore.getState().clearSequence();
  });

  it('selectBeat copies the pattern (edits never mutate the library)', () => {
    const s = useAppStore.getState();
    s.selectBeat('Disco', 2);
    s.toggleBeatHit(15, 'clap');
    expect(getPatternsForGenre('Disco')[2]!.hits.some((h) => h.step === 15 && h.sound === 'clap')).toBe(false);
    expect(useAppStore.getState().beatEdited).toBe(true);
  });

  it('toggleBeatHit adds then removes a hit', () => {
    const s = useAppStore.getState();
    s.clearBeat();
    s.toggleBeatHit(4, 'snare');
    expect(useAppStore.getState().beatHits).toEqual([{ step: 4, sound: 'snare', velocity: 1 }]);
    s.toggleBeatHit(4, 'snare');
    expect(useAppStore.getState().beatHits).toEqual([]);
  });

  it('clearSequence empties all slots and selects slot 1 for entry', () => {
    const s = useAppStore.getState();
    s.setSequenceSlot(2, { degree: 5, direction: 'center' });
    s.clearSequence();
    const after = useAppStore.getState();
    expect(after.sequence).toHaveLength(SEQUENCE_SLOTS);
    expect(after.sequence.every((x) => x === null)).toBe(true);
    expect(after.selectedSlot).toBe(0);
  });

  it('looper bars stay within 1–8', () => {
    useAppStore.getState().setLooperBars(0);
    expect(useAppStore.getState().looperBars).toBe(1);
    useAppStore.getState().setLooperBars(12);
    expect(useAppStore.getState().looperBars).toBe(8);
  });
});
