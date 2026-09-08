import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayModeHandler } from '@/audio/play-modes';
import type { AudioEngine } from '@/audio/engine';
import type { MasterClock } from '@/audio/clock';
import type { Arpeggiator } from '@/audio/arpeggiator';
import type { ChordVoicing, Note } from '@/music/types';

function makeNote(midi: number, name: string): Note {
  return { midi, frequency: 440 * 2 ** ((midi - 69) / 12), name, octave: 4 };
}

const voicing: ChordVoicing = {
  notes: [makeNote(60, 'C4'), makeNote(64, 'E4'), makeNote(67, 'G4')],
  bass: null,
  quality: 'major',
  rootName: 'C',
  displayName: 'C',
  inversion: 0,
};

function makeMockEngine() {
  return {
    triggerChord: vi.fn(),
    releaseChord: vi.fn(),
    resume: vi.fn(),
  } as unknown as AudioEngine;
}

function makeMockClock() {
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];
  let tickCallback: ((time: number, step: number) => void) | null = null;
  const clock = {
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setRate: vi.fn(),
    onTick: vi.fn((cb: (time: number, step: number) => void) => {
      tickCallback = cb;
      const unsub = vi.fn();
      unsubscribers.push(unsub);
      return unsub;
    }),
  };
  return {
    clock: clock as unknown as MasterClock,
    fireTick: (time: number, step: number) => tickCallback?.(time, step),
    unsubscribers,
  };
}

function makeMockArpeggiator() {
  return {
    setChord: vi.fn(),
    setPattern: vi.fn(),
    setChordMode: vi.fn(),
    setRate: vi.fn(),
    reset: vi.fn(),
    getNextNote: vi.fn(() => [makeNote(60, 'C4')]),
  } as unknown as Arpeggiator;
}

describe('PlayModeHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('play mode (default)', () => {
    it('triggers all chord notes instantly on chord down', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.handleChordDown(voicing);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      expect(engine.triggerChord).toHaveBeenCalledWith(voicing);
    });

    it('releases all notes on chord up', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.handleChordDown(voicing);
      handler.handleChordUp();
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });

  describe('strum mode', () => {
    it('plays notes sequentially with delays based on strum speed', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('strum');
      handler.setStrumSpeed('fast'); // 15ms interval
      handler.handleChordDown(voicing);

      // First note fires immediately
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      expect((engine.triggerChord as any).mock.calls[0][0].notes).toHaveLength(1);

      vi.advanceTimersByTime(15);
      expect(engine.triggerChord).toHaveBeenCalledTimes(2);
      expect((engine.triggerChord as any).mock.calls[1][0].notes).toHaveLength(2);

      vi.advanceTimersByTime(15);
      expect(engine.triggerChord).toHaveBeenCalledTimes(3);
      expect((engine.triggerChord as any).mock.calls[2][0].notes).toHaveLength(3);
    });

    it('uses slow strum interval (80ms)', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('strum');
      handler.setStrumSpeed('slow');
      handler.handleChordDown(voicing);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(79);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(engine.triggerChord).toHaveBeenCalledTimes(2);
    });

    it('releases and cancels pending strum notes on chord up', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('strum');
      handler.setStrumSpeed('slow');
      handler.handleChordDown(voicing);
      handler.handleChordUp();

      const callsAtRelease = (engine.triggerChord as any).mock.calls.length;
      vi.advanceTimersByTime(500);
      expect(engine.triggerChord).toHaveBeenCalledTimes(callsAtRelease);
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });

  describe('lead mode', () => {
    it('plays only the highest note of the chord', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('lead');
      handler.handleChordDown(voicing);

      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      const arg = (engine.triggerChord as any).mock.calls[0][0] as ChordVoicing;
      expect(arg.notes).toHaveLength(1);
      expect(arg.notes[0].midi).toBe(67);
    });

    it('releases on chord up', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('lead');
      handler.handleChordDown(voicing);
      handler.handleChordUp();
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });

  describe('drone mode', () => {
    it('triggers on chord down and does not release on chord up', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('drone');
      handler.handleChordDown(voicing);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);

      handler.handleChordUp();
      expect(engine.releaseChord).not.toHaveBeenCalled();
    });

    it('releases previous drone and triggers new chord on next chord down', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('drone');
      handler.handleChordDown(voicing);
      handler.handleChordUp();

      const secondVoicing: ChordVoicing = { ...voicing, displayName: 'G' };
      handler.handleChordDown(secondVoicing);

      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
      expect(engine.triggerChord).toHaveBeenCalledTimes(2);
      expect(engine.triggerChord).toHaveBeenLastCalledWith(secondVoicing);
    });
  });

  describe('repeat mode', () => {
    it('starts the clock on chord down and retriggers chord on each tick', () => {
      const engine = makeMockEngine();
      const { clock, fireTick } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('repeat');
      handler.handleChordDown(voicing);
      expect(clock.start).toHaveBeenCalledTimes(1);
      expect(engine.triggerChord).not.toHaveBeenCalled();

      fireTick(0, 0);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      expect(engine.triggerChord).toHaveBeenCalledWith(voicing);

      fireTick(0.5, 1);
      expect(engine.triggerChord).toHaveBeenCalledTimes(2);
    });

    it('stops the clock and releases on chord up', () => {
      const engine = makeMockEngine();
      const { clock, fireTick, unsubscribers } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('repeat');
      handler.handleChordDown(voicing);
      fireTick(0, 0);
      handler.handleChordUp();

      expect(clock.stop).toHaveBeenCalledTimes(1);
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
      expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    });
  });

  describe('arpeggio mode', () => {
    it('sets the chord on the arpeggiator and starts the clock on chord down', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('arpeggio');
      handler.setArpSettings('up', '1/8', 'arpOnly');
      handler.handleChordDown(voicing);

      expect(arp.setChord).toHaveBeenCalledWith(voicing);
      expect(clock.start).toHaveBeenCalledTimes(1);
    });

    it('plays arpeggiated notes on each clock tick', () => {
      const engine = makeMockEngine();
      const { clock, fireTick } = makeMockClock();
      const arp = makeMockArpeggiator();
      (arp.getNextNote as any).mockImplementation((step: number) => [makeNote(60 + step, `N${step}`)]);
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('arpeggio');
      handler.handleChordDown(voicing);

      fireTick(0, 0);
      expect(engine.triggerChord).toHaveBeenCalledTimes(1);
      expect((engine.triggerChord as any).mock.calls[0][0].notes[0].midi).toBe(60);

      fireTick(0.25, 1);
      expect(engine.triggerChord).toHaveBeenCalledTimes(2);
      expect((engine.triggerChord as any).mock.calls[1][0].notes[0].midi).toBe(61);
    });

    it('skips triggering when arpeggiator returns no notes', () => {
      const engine = makeMockEngine();
      const { clock, fireTick } = makeMockClock();
      const arp = makeMockArpeggiator();
      (arp.getNextNote as any).mockReturnValue([]);
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('arpeggio');
      handler.handleChordDown(voicing);
      fireTick(0, 0);
      expect(engine.triggerChord).not.toHaveBeenCalled();
    });

    it('stops the clock, resets the arpeggiator, and releases on chord up', () => {
      const engine = makeMockEngine();
      const { clock, fireTick } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('arpeggio');
      handler.handleChordDown(voicing);
      fireTick(0, 0);
      handler.handleChordUp();

      expect(clock.stop).toHaveBeenCalledTimes(1);
      expect(arp.reset).toHaveBeenCalledTimes(1);
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });

  describe('setArpSettings', () => {
    it('propagates pattern, rate, and chord mode to the arpeggiator and clock', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setArpSettings('downUp', '1/16', 'chordPlusArp');
      expect(arp.setPattern).toHaveBeenCalledWith('downUp');
      expect(arp.setRate).toHaveBeenCalledWith('1/16');
      expect(arp.setChordMode).toHaveBeenCalledWith('chordPlusArp');
      expect(clock.setRate).toHaveBeenCalledWith('1/16');
    });
  });

  describe('setMode cleanup', () => {
    it('stops an active clock-driven mode when switching modes mid-hold', () => {
      const engine = makeMockEngine();
      const { clock, unsubscribers } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('repeat');
      handler.handleChordDown(voicing);
      handler.setMode('play');

      expect(clock.stop).toHaveBeenCalledTimes(1);
      expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    });

    it('releases an active drone when switching modes mid-hold', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('drone');
      handler.handleChordDown(voicing);
      handler.setMode('play');

      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });

  describe('start/stop lifecycle', () => {
    it('start() resumes the audio engine', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.start();
      expect(engine.resume).toHaveBeenCalledTimes(1);
    });

    it('stop() cleans up any active mode and releases notes', () => {
      const engine = makeMockEngine();
      const { clock } = makeMockClock();
      const arp = makeMockArpeggiator();
      const handler = new PlayModeHandler(engine, clock, arp);

      handler.setMode('repeat');
      handler.handleChordDown(voicing);
      handler.stop();

      expect(clock.stop).toHaveBeenCalledTimes(1);
      expect(engine.releaseChord).toHaveBeenCalledTimes(1);
    });
  });
});
