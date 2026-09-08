// Records mic input into an AudioBuffer suitable for SampleSynth.loadBuffer(),
// and detects the recorded pitch so the UI can show the user what note they
// captured.
import { autocorrelate } from './pitch-detection';

/** Concatenates a list of Float32Array PCM chunks into a single buffer. */
export function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

const PROCESSOR_BUFFER_SIZE = 4096;

export class MicSampler {
  private ctx: AudioContext;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private recording = false;
  private lastBuffer: AudioBuffer | null = null;
  private resolveRecording: ((buffer: AudioBuffer) => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Requests mic access and records until stop() is called. */
  async record(): Promise<AudioBuffer> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return this.recordFromStream(stream);
  }

  /** Records from an already-acquired MediaStream (used for testing/reuse). */
  recordFromStream(stream: MediaStream): Promise<AudioBuffer> {
    this.stream = stream;
    this.chunks = [];
    this.recording = true;

    this.source = this.ctx.createMediaStreamSource(stream);
    this.processor = this.ctx.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
    this.processor.onaudioprocess = (event) => {
      if (!this.recording) return;
      const input = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
    };

    this.source.connect(this.processor);
    // ScriptProcessorNode must be connected to a destination to fire
    // onaudioprocess in most implementations; a silent path is used here
    // since we don't want to hear raw mic passthrough.
    this.processor.connect(this.ctx.destination);

    return new Promise((resolve) => {
      this.resolveRecording = resolve;
    });
  }

  /** Stops recording and resolves the pending record() promise with the captured buffer. */
  stop(): void {
    if (!this.recording) return;
    this.recording = false;

    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());

    const merged = mergeChunks(this.chunks);
    const length = Math.max(1, merged.length);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    buffer.getChannelData(0).set(merged);
    this.lastBuffer = buffer;

    this.resolveRecording?.(buffer);
    this.resolveRecording = null;
  }

  /**
   * Runs autocorrelation pitch detection on the given buffer, or the most
   * recently recorded buffer if none is provided.
   */
  getDetectedPitch(buffer?: AudioBuffer): number {
    const target = buffer ?? this.lastBuffer;
    if (!target) return -1;
    return autocorrelate(target.getChannelData(0), target.sampleRate);
  }

  getLastBuffer(): AudioBuffer | null {
    return this.lastBuffer;
  }

  isRecording(): boolean {
    return this.recording;
  }
}
