import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MIDIOutputController } from '@/audio/midi';
import type { ChordVoicing, Note } from '@/music/types';

function makeNote(midi: number): Note {
  return { midi, frequency: 440 * 2 ** ((midi - 69) / 12), name: 'X', octave: 4 };
}

function makeVoicing(midiNotes: number[], bassMidi: number | null = null): ChordVoicing {
  return {
    notes: midiNotes.map(makeNote),
    bass: bassMidi === null ? null : makeNote(bassMidi),
    quality: 'major',
    rootName: 'C',
    displayName: 'C',
    inversion: 0,
  };
}

function makeFakeOutput() {
  return { id: 'out-1', name: 'Fake Output', send: vi.fn() };
}

describe('MIDIOutputController', () => {
  const originalRequestMIDIAccess = (navigator as any).requestMIDIAccess;

  afterEach(() => {
    if (originalRequestMIDIAccess === undefined) {
      delete (navigator as any).requestMIDIAccess;
    } else {
      (navigator as any).requestMIDIAccess = originalRequestMIDIAccess;
    }
  });

  it('reports unavailable when navigator.requestMIDIAccess is missing', () => {
    delete (navigator as any).requestMIDIAccess;
    const midi = new MIDIOutputController();
    expect(midi.isAvailable()).toBe(false);
  });

  it('init() returns false when Web MIDI API is unavailable', async () => {
    delete (navigator as any).requestMIDIAccess;
    const midi = new MIDIOutputController();
    const ok = await midi.init();
    expect(ok).toBe(false);
  });

  it('reports available and initializes when requestMIDIAccess is present', async () => {
    const fakeOutput = makeFakeOutput();
    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue({
      outputs: new Map([[fakeOutput.id, fakeOutput]]),
    });
    const midi = new MIDIOutputController();
    expect(midi.isAvailable()).toBe(true);
    const ok = await midi.init();
    expect(ok).toBe(true);
    expect(midi.getOutputs()).toEqual([fakeOutput]);
  });

  describe('with an initialized output', () => {
    let midi: MIDIOutputController;
    let fakeOutput: ReturnType<typeof makeFakeOutput>;

    beforeEach(async () => {
      fakeOutput = makeFakeOutput();
      (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue({
        outputs: new Map([[fakeOutput.id, fakeOutput]]),
      });
      midi = new MIDIOutputController();
      await midi.init();
    });

    it('sendNoteOn formats [0x90|channel, note, velocity]', () => {
      midi.sendNoteOn(60, 100, 0);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x90, 60, 100]);
    });

    it('sendNoteOn respects a non-zero channel', () => {
      midi.sendNoteOn(60, 100, 3);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x93, 60, 100]);
    });

    it('sendNoteOff formats [0x80|channel, note, 0]', () => {
      midi.sendNoteOff(60, 0);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x80, 60, 0]);
    });

    it('sendChord sends noteOn for each note in the voicing, including bass', () => {
      const voicing = makeVoicing([60, 64, 67], 48);
      midi.sendChord(voicing);
      expect(fakeOutput.send).toHaveBeenCalledTimes(4);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x90, 60, DEFAULT_VELOCITY_CONST]);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x90, 64, DEFAULT_VELOCITY_CONST]);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x90, 67, DEFAULT_VELOCITY_CONST]);
      expect(fakeOutput.send).toHaveBeenCalledWith([0x90, 48, DEFAULT_VELOCITY_CONST]);
    });

    it('sendChord omits bass note-on when voicing has no bass', () => {
      const voicing = makeVoicing([60, 64, 67], null);
      midi.sendChord(voicing);
      expect(fakeOutput.send).toHaveBeenCalledTimes(3);
    });

    it('releaseAll sends noteOff for all currently held notes', () => {
      const voicing = makeVoicing([60, 64, 67], 48);
      midi.sendChord(voicing);
      fakeOutput.send.mockClear();

      midi.releaseAll();

      expect(fakeOutput.send).toHaveBeenCalledTimes(4);
      for (const note of [60, 64, 67, 48]) {
        expect(fakeOutput.send).toHaveBeenCalledWith([0x80, note, 0]);
      }
    });

    it('releaseAll clears held notes so a second call sends nothing', () => {
      midi.sendNoteOn(60);
      midi.releaseAll();
      fakeOutput.send.mockClear();

      midi.releaseAll();

      expect(fakeOutput.send).not.toHaveBeenCalled();
    });

    it('selectOutput switches to the given device id', () => {
      const secondOutput = { id: 'out-2', name: 'Second', send: vi.fn() };
      // Manually add a second output via a fresh access object.
      (midi as any).access.outputs.set(secondOutput.id, secondOutput);

      midi.selectOutput('out-2');
      midi.sendNoteOn(60);

      expect(secondOutput.send).toHaveBeenCalledWith([0x90, 60, 100]);
      expect(fakeOutput.send).not.toHaveBeenCalled();
    });
  });

  it('is a no-op when no output is selected', () => {
    delete (navigator as any).requestMIDIAccess;
    const midi = new MIDIOutputController();
    expect(() => {
      midi.sendNoteOn(60);
      midi.sendNoteOff(60);
      midi.sendChord(makeVoicing([60, 64, 67]));
      midi.releaseAll();
    }).not.toThrow();
  });
});

const DEFAULT_VELOCITY_CONST = 100;
