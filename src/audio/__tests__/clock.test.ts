import { describe, it, expect, vi } from 'vitest';
import { MasterClock } from '@/audio/clock';

describe('MasterClock', () => {
  it('calculates correct step duration at 120 BPM, 1/8 rate', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    // At 120 BPM, a 1/8 note = 0.25 seconds
    expect(clock.getStepDuration('1/8')).toBeCloseTo(0.25, 3);
  });

  it('calculates correct step duration at 120 BPM, 1/4 rate', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    expect(clock.getStepDuration('1/4')).toBeCloseTo(0.5, 3);
  });

  it('calculates swing eighth', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    const dur = clock.getStepDuration('swing8');
    // Swing 8th alternates long-short, average should be ~0.25
    expect(dur).toBeGreaterThan(0);
  });

  it('clamps BPM to 40-300', () => {
    const clock = new MasterClock();
    clock.setBpm(10);
    expect(clock.getBpm()).toBe(40);
    clock.setBpm(500);
    expect(clock.getBpm()).toBe(300);
  });

  it('is not running before start() is called', () => {
    const clock = new MasterClock();
    expect(clock.isRunning()).toBe(false);
  });

  it('does not start without an AudioContext', () => {
    const clock = new MasterClock();
    clock.start();
    expect(clock.isRunning()).toBe(false);
  });

  it('starts and stops with a context, firing tick callbacks via lookahead scheduling', () => {
    vi.useFakeTimers();
    const fakeCtx = { currentTime: 0 } as unknown as BaseAudioContext;
    const clock = new MasterClock(fakeCtx);
    clock.setBpm(120);
    clock.setRate('1/8'); // 0.25s per step

    const ticks: Array<{ time: number; step: number }> = [];
    clock.onTick((time, step) => ticks.push({ time, step }));

    clock.start();
    expect(clock.isRunning()).toBe(true);

    // Advance the fake AudioContext clock and the timer together.
    (fakeCtx as { currentTime: number }).currentTime = 0.3;
    vi.advanceTimersByTime(25);

    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].step).toBe(0);

    clock.stop();
    expect(clock.isRunning()).toBe(false);
    vi.useRealTimers();
  });

  it('onTick returns an unsubscribe function', () => {
    const clock = new MasterClock();
    const cb = vi.fn();
    const unsubscribe = clock.onTick(cb);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
