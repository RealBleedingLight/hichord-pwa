import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, currentSection, SEQUENCE_SLOTS, SECTION_NAMES } from '@/store';
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
    expect(currentSection(after)).toHaveLength(SEQUENCE_SLOTS);
    expect(currentSection(after).every((x) => x === null)).toBe(true);
    expect(after.selectedSlot).toBe(0);
  });

  it('edits only the section being edited, and copies sections', () => {
    const s = useAppStore.getState();
    s.setEditSection(0);
    s.setSequenceSlot(0, { degree: 1, direction: 'center' });
    s.setEditSection(1);
    expect(currentSection(useAppStore.getState())[0]).toBeNull();
    s.copySection(0, 1);
    expect(currentSection(useAppStore.getState())[0]).toEqual({ degree: 1, direction: 'center' });
    expect(useAppStore.getState().sections).toHaveLength(SECTION_NAMES.length);
  });

  it('song chain never becomes empty', () => {
    useAppStore.getState().setSongChain([]);
    expect(useAppStore.getState().songChain).toEqual([0]);
  });

  it('beat cells cycle full → soft → off', () => {
    const s = useAppStore.getState();
    s.clearBeat();
    s.cycleBeatHit(2, 'kick');
    expect(useAppStore.getState().beatHits).toEqual([{ step: 2, sound: 'kick', velocity: 1 }]);
    s.cycleBeatHit(2, 'kick');
    expect(useAppStore.getState().beatHits).toEqual([{ step: 2, sound: 'kick', velocity: 0.4 }]);
    s.cycleBeatHit(2, 'kick');
    expect(useAppStore.getState().beatHits).toEqual([]);
  });

  it('tempo is locked while loops exist', () => {
    useAppStore.setState({ bpm: 100 });
    useAppStore.getState().setLooperTrack(0, { state: 'playing' });
    useAppStore.getState().setBpm(130);
    expect(useAppStore.getState().bpm).toBe(100);
    expect(useAppStore.getState().toast?.text).toMatch(/locked/i);
    useAppStore.getState().setLooperTrack(0, { state: 'empty' });
    useAppStore.getState().setBpm(130);
    expect(useAppStore.getState().bpm).toBe(130);
  });

  it('looper bars stay within 1–8', () => {
    useAppStore.getState().setLooperBars(0);
    expect(useAppStore.getState().looperBars).toBe(1);
    useAppStore.getState().setLooperBars(12);
    expect(useAppStore.getState().looperBars).toBe(8);
  });

  it('recent chords keep the last 8 and can be captured into the edited section', () => {
    const s = useAppStore.getState();
    s.clearRecentChords();
    s.setEditSection(2);
    for (let i = 0; i < 10; i++) s.pushRecentChord({ degree: ((i % 7) + 1) as 1, direction: 'center' });
    s.updateRecentChord({ degree: 4, direction: 'right' });
    const recent = useAppStore.getState().recentChords;
    expect(recent).toHaveLength(8);
    expect(recent[7]).toEqual({ degree: 4, direction: 'right' });
    s.captureRecentToSection();
    expect(useAppStore.getState().sections[2]).toEqual(recent);
  });

  it('section beats default to the main beat and can be overridden per section', () => {
    const s = useAppStore.getState();
    expect(s.sectionBeats.every((b) => b === null)).toBe(true);
    s.setSectionBeat(1, 2);
    expect(useAppStore.getState().sectionBeats[1]).toBe(2);
  });
});
