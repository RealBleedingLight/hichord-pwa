import type { Note, ChordVoicing } from '@/music/types';
import type { ArpPattern, ArpChordMode, ArpRate } from './types';

export class Arpeggiator {
  private chord: ChordVoicing | null = null;
  private pattern: ArpPattern = 'up';
  private chordMode: ArpChordMode = 'arpOnly';
  private rate: ArpRate = '1/8';

  setChord(voicing: ChordVoicing): void { this.chord = voicing; }
  setPattern(pattern: ArpPattern): void { this.pattern = pattern; }
  setChordMode(mode: ArpChordMode): void { this.chordMode = mode; }
  setRate(rate: ArpRate): void { this.rate = rate; }

  getChordMode(): ArpChordMode { return this.chordMode; }
  getRate(): ArpRate { return this.rate; }

  reset(): void { this.chord = null; }

  getNextNote(step: number): Note[] {
    if (!this.chord || this.chord.notes.length === 0) return [];
    const notes = this.chord.notes;
    const len = notes.length;

    let index: number;
    switch (this.pattern) {
      case 'up':
        index = step % len;
        break;
      case 'down':
        index = (len - 1) - (step % len);
        break;
      case 'upDown': {
        const cycle = len * 2;
        const pos = step % cycle;
        index = pos < len ? pos : (cycle - 1 - pos);
        break;
      }
      case 'downUp': {
        const cycle = len * 2;
        const pos = step % cycle;
        index = pos < len ? (len - 1 - pos) : (pos - len);
        break;
      }
      case 'random':
        index = Math.floor(Math.random() * len);
        break;
      case 'fingerpick': {
        // Pattern: root, 3rd, 5th, 3rd (repeated)
        const fingerpickPattern = [0, 1, 2, 1];
        index = (fingerpickPattern[step % 4] ?? 0) % len;
        break;
      }
      default:
        index = step % len;
    }

    const note = notes[index];
    return note ? [note] : [];
  }
}
