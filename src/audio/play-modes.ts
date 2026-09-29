import type { ChordVoicing, Note } from '@/music/types';
import type { AudioEngine } from './engine';
import type { MasterClock } from './clock';
import type { Arpeggiator } from './arpeggiator';
import type { PlayMode, StrumSpeed, ArpPattern, ArpRate, ArpChordMode } from './types';
import { STRUM_INTERVALS } from './types';

const up12 = (n: Note): Note => ({ ...n, midi: n.midi + 12, frequency: n.frequency * 2, octave: n.octave + 1 });

/** Fraction of a clock step that repeat/arp notes sound for (the rest is gap). */
const REPEAT_GATE = 0.5;
const ARP_GATE = 0.85;

/**
 * Routes chord-down/chord-up events from the UI to the AudioEngine according to
 * the currently active PlayMode (Play, Strum, Lead, Drone, Repeat, Arpeggio).
 *
 * The clock passed in is dedicated to this handler (the arp/repeat rate), so
 * it never fights the transport clock that drives the beat and sequencer.
 */
export class PlayModeHandler {
  private mode: PlayMode = 'play';
  private strumSpeed: StrumSpeed = 'medium';
  private droneActive = false;
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

  getMode(): PlayMode {
    return this.mode;
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
    switch (this.mode) {
      case 'strum':
        this.engine.triggerChord(voicing, undefined, STRUM_INTERVALS[this.strumSpeed] / 1000);
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

  /**
   * Switches the chord that's already sounding (e.g. the gesture pad moved
   * while a key is held). Clock-driven modes keep their rhythm and pick up the
   * new notes on the next step instead of restarting from step 0.
   */
  updateChord(voicing: ChordVoicing): void {
    if (this.mode === 'arpeggio' && this.tickUnsubscribe) {
      this.arpeggiator.setChord(voicing);
      if (this.bedVoicing) this.bedVoicing = voicing;
      if (this.arpChordMode() === 'chordPlusArp') this.morphOrTrigger(voicing, 'bed');
      return;
    }
    if (this.mode === 'repeat' && this.tickUnsubscribe) {
      this.repeatVoicing = voicing;
      return;
    }
    if ((this.mode === 'play' || this.mode === 'drone') && this.canMorph()) {
      this.morphOrTrigger(voicing, 'live');
      return;
    }
    this.handleChordDown(voicing);
  }

  private canMorph(): boolean {
    const engine = this.engine as AudioEngine & { prefersMorph?: () => boolean };
    return typeof engine.prefersMorph === 'function' && engine.prefersMorph();
  }

  private morphOrTrigger(voicing: ChordVoicing, group: 'live' | 'bed'): void {
    const engine = this.engine as AudioEngine & { morphChord?: AudioEngine['morphChord'] };
    if (typeof engine.morphChord === 'function') engine.morphChord(voicing, group);
    else this.engine.triggerChord(voicing, undefined, 0, group);
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
        this.engine.releaseChord();
    }
  }

  /** Resumes the audio engine so playback can begin. */
  start(): void {
    void this.engine.resume();
  }

  /** Panic/cleanup: stops any active mode-specific playback and releases notes. */
  stop(): void {
    if (!this.forceStopActive()) this.engine.releaseChord();
  }

  private handleLeadDown(voicing: ChordVoicing): void {
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    if (allNotes.length === 0) return;
    const highest = allNotes.reduce((a, b) => (b.midi > a.midi ? b : a));
    this.engine.triggerChord({ ...voicing, bass: null, notes: [highest] });
  }

  private handleDroneDown(voicing: ChordVoicing): void {
    this.engine.triggerChord(voicing);
    this.droneActive = true;
  }

  private repeatVoicing: ChordVoicing | null = null;

  private handleRepeatDown(voicing: ChordVoicing): void {
    this.stopClockDrivenMode();
    this.repeatVoicing = voicing;
    // Subscribe before starting: start() fires the first step immediately.
    this.tickUnsubscribe = this.clock.onTick((time) => {
      const current = this.repeatVoicing;
      if (!current) return;
      this.engine.triggerChord(current, time);
      this.engine.releaseChord(time + this.stepSeconds() * REPEAT_GATE);
    });
    this.clock.start();
  }

  private arpChordMode(): ArpChordMode {
    const arp = this.arpeggiator as Arpeggiator & { getChordMode?: () => ArpChordMode };
    return typeof arp.getChordMode === 'function' ? arp.getChordMode() : 'arpOnly';
  }

  private handleArpeggioDown(voicing: ChordVoicing): void {
    this.stopClockDrivenMode();
    this.arpeggiator.setChord(voicing);
    const chordMode = this.arpChordMode();
    this.bedVoicing = chordMode === 'arpOnly' ? null : voicing;
    // CHORD+ARP: the chord sustains underneath while the arp runs an octave up.
    if (chordMode === 'chordPlusArp') this.engine.triggerChord(voicing, undefined, 0, 'bed');
    const layered = chordMode !== 'arpOnly';

    this.tickUnsubscribe = this.clock.onTick((time, step) => {
      const step_ = this.stepSeconds();
      // RHYTHM+ARP: the chord pulses on every beat under the arp.
      if (chordMode === 'rhythmPlusArp' && this.bedVoicing && step % this.stepsPerBeat() === 0) {
        this.engine.triggerChord(this.bedVoicing, time, 0, 'bed');
        this.engine.releaseChord(time + step_ * this.stepsPerBeat() * 0.5, 'bed');
      }
      const notes = this.arpeggiator.getNextNote(step);
      if (notes.length === 0) return;
      this.engine.triggerChord({ ...voicing, bass: null, notes: layered ? notes.map(up12) : notes }, time);
      this.engine.releaseChord(time + step_ * ARP_GATE);
    });
    this.clock.start();
  }

  private bedVoicing: ChordVoicing | null = null;

  /** Clock steps per quarter note at the current rate (at least 1). */
  private stepsPerBeat(): number {
    const clock = this.clock as MasterClock & { getStepDuration?: (r?: ArpRate) => number };
    if (typeof clock.getStepDuration !== 'function') return 1;
    return Math.max(1, Math.round(clock.getStepDuration('1/4') / clock.getStepDuration()));
  }

  private stepSeconds(): number {
    const clock = this.clock as MasterClock & { getStepDuration?: () => number };
    return typeof clock.getStepDuration === 'function' ? clock.getStepDuration() : 0.25;
  }

  private stopClockDrivenMode(): void {
    if (this.tickUnsubscribe) {
      this.tickUnsubscribe();
      this.tickUnsubscribe = null;
      this.clock.stop();
      this.repeatVoicing = null;
      if (this.bedVoicing) {
        this.engine.releaseChord(undefined, 'bed');
        this.bedVoicing = null;
      }
      if (this.mode === 'arpeggio') {
        this.arpeggiator.reset();
      }
    }
  }

  /** Stops whatever mode-specific playback is in flight. Returns true if it released notes. */
  private forceStopActive(): boolean {
    const active = this.tickUnsubscribe !== null || this.droneActive;
    this.stopClockDrivenMode();
    this.droneActive = false;
    if (active) this.engine.releaseChord();
    return active;
  }
}
