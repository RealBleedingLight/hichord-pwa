import type { ScaleDegree, JoystickDirection } from '@/music/types';

export interface SequencerStep {
  degree: ScaleDegree;
  direction: JoystickDirection;
  durationSteps: number;
}

export class Sequencer {
  private steps: (SequencerStep | null)[] = new Array(16).fill(null);

  setStep(index: number, degree: ScaleDegree, direction: JoystickDirection, duration = 1): void {
    if (index < 0 || index >= 16) return;
    this.steps[index] = { degree, direction, durationSteps: duration };
  }

  removeStep(index: number): void {
    if (index >= 0 && index < 16) this.steps[index] = null;
  }

  getStep(index: number): SequencerStep | null {
    return this.steps[index] ?? null;
  }

  getStepAtPosition(step: number): SequencerStep | null {
    return this.getStep(step % 16);
  }

  clear(): void {
    this.steps.fill(null);
  }

  getLength(): number { return 16; }

  getSteps(): (SequencerStep | null)[] { return [...this.steps]; }
}
