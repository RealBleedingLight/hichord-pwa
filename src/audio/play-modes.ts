import type { ChordVoicing } from '@/music/types';
import type { AudioEngine } from './engine';
import type { MasterClock } from './clock';
import type { Arpeggiator } from './arpeggiator';
import type { PlayMode, StrumSpeed, ArpPattern, ArpRate, ArpChordMode } from './types';
import { STRUM_INTERVALS } from './types';

/**
 * Routes chord-down/chord-up events from the UI to the AudioEngine according to
 * the currently active PlayMode (Play, Strum, Lead, Drone, Repeat, Arpeggio).
 */
export class PlayModeHandler {
  private mode: PlayMode = 'play';
  private strumSpeed: StrumSpeed = 'medium';
  private droneActive = false;
  private strumTimeouts: ReturnType<typeof setTimeout>[] = [];
  private tickUnsubscribe: (() => void) | null = null;

  constructor(
    private engine: AudioEngine,
    private clock: MasterClock,
    private arpeggiator: Arpeggiator,
  ) {}

  setMode(mode: PlayMode): void {
    this.forceStopActive();
    this.mode = mode;
  }

  setStrumSpeed(speed: StrumSpeed): void {
    this.strumSpeed = speed;
  }

  setArpSettings(pattern: ArpPattern, rate: ArpRate, chordMode: ArpChordMode): void {
    this.arpeggiator.setPattern(pattern);
    this.arpeggiator.setRate(rate);
    this.arpeggiator.setChordMode(chordMode);
    this.clock.setRate(rate);
  }

  handleChordDown(voicing: ChordVoicing): void {
    this.clearStrumTimeouts();
    switch (this.mode) {
      case 'strum':
        this.handleStrumDown(voicing);
        break;
      case 'lead':
        this.handleLeadDown(voicing);
        break;
      case 'drone':
        this.handleDroneDown(voicing);
        break;
      case 'repeat':
        this.handleRepeatDown(voicing);
        break;
      case 'arpeggio':
        this.handleArpeggioDown(voicing);
        break;
      case 'play':
      default:
        this.engine.triggerChord(voicing);
        break;
    }
  }

  handleChordUp(): void {
    switch (this.mode) {
      case 'drone':
        // Infinite sustain — released only when the next chord down fires.
        return;
      case 'repeat':
      case 'arpeggio':
        this.stopClockDrivenMode();
        this.engine.releaseChord();
        return;
      default:
        this.clearStrumTimeouts();
        this.engine.releaseChord();
    }
  }

  /** Resumes the audio engine so playback can begin. */
  start(): void {
    void this.engine.resume();
  }

  /** Panic/cleanup: stops any active mode-specific playback and releases notes. */
  stop(): void {
    this.forceStopActive();
    this.engine.releaseChord();
  }

  private handleStrumDown(voicing: ChordVoicing): void {
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    const interval = STRUM_INTERVALS[this.strumSpeed];

    allNotes.forEach((_, i) => {
      const fire = () => {
        this.engine.triggerChord({ ...voicing, bass: null, notes: allNotes.slice(0, i + 1) });
      };
      if (i === 0) {
        fire();
      } else {
        this.strumTimeouts.push(setTimeout(fire, interval * i));
      }
    });
  }

  private handleLeadDown(voicing: ChordVoicing): void {
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    if (allNotes.length === 0) return;
    const highest = allNotes.reduce((a, b) => (b.midi > a.midi ? b : a));
    this.engine.triggerChord({ ...voicing, bass: null, notes: [highest] });
  }

  private handleDroneDown(voicing: ChordVoicing): void {
    if (this.droneActive) {
      this.engine.releaseChord();
    }
    this.engine.triggerChord(voicing);
    this.droneActive = true;
  }

  private handleRepeatDown(voicing: ChordVoicing): void {
    this.stopClockDrivenMode();
    this.clock.start();
    this.tickUnsubscribe = this.clock.onTick(() => {
      this.engine.triggerChord(voicing);
    });
  }

  private handleArpeggioDown(voicing: ChordVoicing): void {
    this.stopClockDrivenMode();
    this.arpeggiator.setChord(voicing);
    this.clock.start();
    this.tickUnsubscribe = this.clock.onTick((_time, step) => {
      const notes = this.arpeggiator.getNextNote(step);
      if (notes.length === 0) return;
      this.engine.triggerChord({ ...voicing, bass: null, notes });
    });
  }

  private stopClockDrivenMode(): void {
    if (this.tickUnsubscribe) {
      this.tickUnsubscribe();
      this.tickUnsubscribe = null;
      this.clock.stop();
      if (this.mode === 'arpeggio') {
        this.arpeggiator.reset();
      }
    }
  }

  private clearStrumTimeouts(): void {
    for (const t of this.strumTimeouts) clearTimeout(t);
    this.strumTimeouts = [];
  }

  /** Stops whatever mode-specific playback is in flight, without releasing the synth. */
  private forceStopActive(): void {
    this.clearStrumTimeouts();
    if (this.tickUnsubscribe) {
      this.tickUnsubscribe();
      this.tickUnsubscribe = null;
      this.clock.stop();
      if (this.mode === 'arpeggio') {
        this.arpeggiator.reset();
      }
    }
    if (this.droneActive) {
      this.engine.releaseChord();
      this.droneActive = false;
    }
  }
}
