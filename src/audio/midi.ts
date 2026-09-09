import type { ChordVoicing, Note } from '@/music/types';

// Note: MIDIAccess/MIDIOutput/MIDIOutputMap and Navigator.requestMIDIAccess
// are provided by TypeScript's built-in lib.dom.d.ts — no extra ambient
// declarations are needed here.

const DEFAULT_VELOCITY = 100;
const DEFAULT_CHANNEL = 0;

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Wraps the Web MIDI API to send chord/note events to an external MIDI output device.
 * Degrades gracefully (all methods become no-ops) when Web MIDI is unavailable
 * or no output device has been selected.
 */
export class MIDIOutputController {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private heldNotes = new Set<number>();
  private channel = DEFAULT_CHANNEL;

  /** Requests Web MIDI access. Returns true if the API is available and access was granted. */
  async init(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      this.access = await navigator.requestMIDIAccess!();
      const outputs = this.getOutputs();
      if (outputs.length > 0) {
        this.output = outputs[0]!;
      }
      return true;
    } catch {
      this.access = null;
      return false;
    }
  }

  /** Returns whether the Web MIDI API is present in this environment. */
  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  /** Lists all currently available MIDI outputs. */
  getOutputs(): MIDIOutput[] {
    if (!this.access) return [];
    const outputs: MIDIOutput[] = [];
    this.access.outputs.forEach((output) => outputs.push(output));
    return outputs;
  }

  /** Selects the MIDI output to send to, by device id. No-op if the id is unknown. */
  selectOutput(id: string): void {
    const found = this.getOutputs().find((o) => o.id === id);
    if (found) this.output = found;
  }

  /** Sets the MIDI channel (0-15) used for outgoing messages. */
  setChannel(channel: number): void {
    this.channel = Math.max(0, Math.min(15, channel));
  }

  /** Sends a Note On message. */
  sendNoteOn(note: number, velocity: number = DEFAULT_VELOCITY, channel: number = this.channel): void {
    if (!this.output) return;
    this.output.send([NOTE_ON | (channel & 0x0f), note & 0x7f, velocity & 0x7f]);
    this.heldNotes.add(note);
  }

  /** Sends a Note Off message. */
  sendNoteOff(note: number, channel: number = this.channel): void {
    if (!this.output) return;
    this.output.send([NOTE_OFF | (channel & 0x0f), note & 0x7f, 0]);
    this.heldNotes.delete(note);
  }

  /** Sends Note On messages for every note in the chord voicing, including the bass note if present. */
  sendChord(voicing: ChordVoicing, velocity: number = DEFAULT_VELOCITY, channel: number = this.channel): void {
    if (!this.output) return;
    const notes: Note[] = voicing.bass ? [...voicing.notes, voicing.bass] : voicing.notes;
    for (const note of notes) {
      this.sendNoteOn(note.midi, velocity, channel);
    }
  }

  /** Sends Note Off for every currently held note. */
  releaseAll(): void {
    if (!this.output) {
      this.heldNotes.clear();
      return;
    }
    for (const note of this.heldNotes) {
      this.output.send([NOTE_OFF | (this.channel & 0x0f), note & 0x7f, 0]);
    }
    this.heldNotes.clear();
  }
}
