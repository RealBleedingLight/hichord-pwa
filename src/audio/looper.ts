import type { LooperState } from './types';
import { getLooperWorkletUrl } from './looper-worklet';

export function calculateLoopLength(bars: number, bpm: number, sampleRate: number): number {
  const beatsPerBar = 4;
  const beatDuration = 60 / bpm;
  return Math.round(bars * beatsPerBar * beatDuration * sampleRate);
}

export class LooperController {
  private ctx: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private state: LooperState = 'off';
  private initialized = false;
  private onStateChange: ((state: LooperState, trackIndex?: number) => void) | null = null;

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
    });
    this.workletNode.port.onmessage = (e) => {
      if (e.data.type === 'recordingDone') {
        this.state = 'looping';
        this.onStateChange?.('looping', e.data.trackIndex);
      }
    };
    this.initialized = true;
  }

  connectInput(source: AudioNode): void {
    source.connect(this.workletNode!);
  }

  connectOutput(dest: AudioNode): void {
    this.workletNode!.connect(dest);
  }

  startRecording(trackIndex: number, loopLengthSamples: number): void {
    this.state = 'recording';
    this.workletNode?.port.postMessage({
      type: 'startRecord',
      trackIndex,
      loopLength: loopLengthSamples,
    });
  }

  stopRecording(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'stopRecord', trackIndex });
    this.state = 'looping';
  }

  togglePlayback(): void {
    if (this.state === 'looping') {
      this.workletNode?.port.postMessage({ type: 'stop' });
      this.state = 'off';
    } else {
      this.workletNode?.port.postMessage({ type: 'play' });
      this.state = 'looping';
    }
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

  clearAll(): void {
    this.workletNode?.port.postMessage({ type: 'clearAll' });
    this.state = 'off';
  }

  getState(): LooperState {
    return this.state;
  }

  onStateChanged(cb: (state: LooperState, trackIndex?: number) => void): void {
    this.onStateChange = cb;
  }
}
