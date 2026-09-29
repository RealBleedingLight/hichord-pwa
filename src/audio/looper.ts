import { getLooperWorkletUrl } from './looper-worklet';

export function calculateLoopLength(bars: number, bpm: number, sampleRate: number): number {
  const beatsPerBar = 4;
  const beatDuration = 60 / bpm;
  return Math.round(bars * beatsPerBar * beatDuration * sampleRate);
}

export interface LoopSnapshot {
  loopLength: number;
  tracks: ({ left: Float32Array; right: Float32Array; gain: number; muted: boolean } | null)[];
}

export type LooperEvent =
  | { type: 'recordingDone'; trackIndex: number }
  | { type: 'recordingCancelled'; trackIndex: number }
  | { type: 'position'; phase: number }
  | ({ type: 'exported'; requestId: number } & LoopSnapshot);

/**
 * Main-thread side of the looper worklet. All timing lives in the worklet;
 * this class translates AudioContext times into frames and forwards events.
 */
export class LooperController {
  private ctx: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private initialized = false;
  private listeners: ((e: LooperEvent) => void)[] = [];

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const url = getLooperWorkletUrl();
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.workletNode = new AudioWorkletNode(this.ctx, 'looper-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    });
    this.workletNode.port.onmessage = (e) => {
      for (const l of this.listeners) l(e.data as LooperEvent);
    };
    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized;
  }

  onEvent(cb: (e: LooperEvent) => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  connectInput(source: AudioNode): void {
    source.connect(this.workletNode!);
  }

  connectOutput(dest: AudioNode): void {
    this.workletNode!.connect(dest);
  }

  private toFrame(time: number | undefined): number {
    return Math.round((time ?? this.ctx.currentTime) * this.ctx.sampleRate);
  }

  /**
   * Records one loop cycle on `trackIndex`, starting at AudioContext time
   * `startAt`. The first track recorded sets the loop to `loopLengthSamples`;
   * later tracks follow the existing loop.
   */
  startRecording(trackIndex: number, loopLengthSamples: number, startAt?: number): void {
    this.workletNode?.port.postMessage({
      type: 'startRecord',
      trackIndex,
      loopLength: loopLengthSamples,
      startFrame: this.toFrame(startAt),
    });
  }

  stopRecording(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'stopRecord', trackIndex });
  }

  /** Restarts loop playback from the top at `startAt`. */
  play(startAt?: number): void {
    this.workletNode?.port.postMessage({ type: 'play', startFrame: this.toFrame(startAt) });
  }

  stop(): void {
    this.workletNode?.port.postMessage({ type: 'stop' });
  }

  setTrackGain(trackIndex: number, gain: number): void {
    this.workletNode?.port.postMessage({ type: 'setGain', trackIndex, gain });
  }

  muteTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'mute', trackIndex });
  }

  unmuteTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'unmute', trackIndex });
  }

  clearTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'clearTrack', trackIndex });
  }

  private nextRequest = 0;

  /** Copies all recorded audio out of the worklet (for saving / WAV export). */
  exportTracks(): Promise<LoopSnapshot> {
    const requestId = ++this.nextRequest;
    return new Promise((resolve) => {
      const off = this.onEvent((e) => {
        if (e.type === 'exported' && e.requestId === requestId) {
          off();
          resolve({ loopLength: e.loopLength, tracks: e.tracks });
        }
      });
      this.workletNode?.port.postMessage({ type: 'export', requestId });
    });
  }

  /** Loads previously saved loops (stopped; call play() to hear them). */
  importTracks(snapshot: LoopSnapshot): void {
    this.workletNode?.port.postMessage({ type: 'import', ...snapshot });
  }

  clearAll(): void {
    this.workletNode?.port.postMessage({ type: 'clearAll' });
  }
}
