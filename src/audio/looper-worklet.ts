// This file is loaded as an AudioWorklet module.
//
// Timing model: the first track recorded defines the master loop (its length
// and the frame it started on). Every other track is recorded for exactly one
// full cycle, written at the master loop's current phase, so overdubs are
// always in sync no matter when record is pressed. Start frames come from the
// main thread so recording can begin sample-accurately after a count-in.
const LOOPER_PROCESSOR_CODE = `
const NUM_TRACKS = 6;
const POSITION_REPORT_FRAMES = 2048;

class LooperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tracks = [];
    for (let i = 0; i < NUM_TRACKS; i++) {
      this.tracks.push({
        left: null,
        right: null,
        hasAudio: false,
        recording: false,
        recordStart: 0,
        recorded: 0,
        gain: 1.0,
        muted: false,
      });
    }
    this.loopLength = 0;
    this.loopStart = 0;
    this.playing = false;
    this.lastReport = 0;
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  masterTrackIndex() {
    return this.tracks.findIndex((t) => t.hasAudio || t.recording);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'startRecord': {
        const track = this.tracks[msg.trackIndex];
        const startFrame = Math.max(msg.startFrame || currentFrame, currentFrame);
        // The first track with audio defines the loop; re-recording the only
        // track redefines it.
        const isMaster = !this.tracks.some((t, i) => i !== msg.trackIndex && t.hasAudio);
        if (isMaster) {
          this.loopLength = msg.loopLength;
          this.loopStart = startFrame;
          for (const t of this.tracks) { if (t !== track) { t.left = null; t.right = null; t.hasAudio = false; } }
        }
        track.left = new Float32Array(this.loopLength);
        track.right = new Float32Array(this.loopLength);
        track.hasAudio = false;
        track.recording = true;
        track.recordStart = startFrame;
        track.recorded = 0;
        this.playing = true;
        break;
      }
      case 'stopRecord': {
        const track = this.tracks[msg.trackIndex];
        if (!track.recording) break;
        track.recording = false;
        if (track.recorded === 0) {
          track.left = null; track.right = null; track.hasAudio = false;
          if (this.masterTrackIndex() === -1) this.loopLength = 0;
          this.port.postMessage({ type: 'recordingCancelled', trackIndex: msg.trackIndex });
          break;
        }
        track.hasAudio = true;
        this.port.postMessage({ type: 'recordingDone', trackIndex: msg.trackIndex });
        break;
      }
      case 'play':
        if (this.loopLength > 0) {
          this.playing = true;
          this.loopStart = Math.max(msg.startFrame || currentFrame, currentFrame);
        }
        break;
      case 'stop':
        this.playing = false;
        for (let i = 0; i < NUM_TRACKS; i++) {
          const t = this.tracks[i];
          if (t.recording) {
            t.recording = false;
            t.hasAudio = t.recorded > 0;
            this.port.postMessage({ type: t.hasAudio ? 'recordingDone' : 'recordingCancelled', trackIndex: i });
          }
        }
        break;
      case 'setGain':
        this.tracks[msg.trackIndex].gain = msg.gain;
        break;
      case 'mute':
        this.tracks[msg.trackIndex].muted = true;
        break;
      case 'unmute':
        this.tracks[msg.trackIndex].muted = false;
        break;
      case 'clearTrack': {
        const t = this.tracks[msg.trackIndex];
        t.left = null; t.right = null; t.hasAudio = false; t.recording = false;
        if (this.masterTrackIndex() === -1) { this.loopLength = 0; this.playing = false; }
        break;
      }
      case 'clearAll':
        for (const t of this.tracks) { t.left = null; t.right = null; t.hasAudio = false; t.recording = false; }
        this.loopLength = 0;
        this.playing = false;
        break;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0].length;
    const inL = input && input[0];
    const inR = input && (input[1] || input[0]);
    const outL = output[0];
    const outR = output[1] || output[0];

    for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
    if (this.loopLength === 0) return true;

    for (let i = 0; i < blockSize; i++) {
      const frame = currentFrame + i;
      if (frame < this.loopStart) continue;
      const pos = (frame - this.loopStart) % this.loopLength;

      for (let ti = 0; ti < NUM_TRACKS; ti++) {
        const track = this.tracks[ti];
        if (track.recording && frame >= track.recordStart) {
          if (inL) {
            track.left[pos] = inL[i];
            track.right[pos] = inR[i];
          }
          track.recorded++;
          if (track.recorded >= this.loopLength) {
            track.recording = false;
            track.hasAudio = true;
            this.port.postMessage({ type: 'recordingDone', trackIndex: ti });
          }
        } else if (this.playing && track.hasAudio && !track.muted) {
          const g = track.gain;
          outL[i] += track.left[pos] * g;
          if (outR !== outL) outR[i] += track.right[pos] * g;
        }
      }
    }

    if (this.playing && currentFrame - this.lastReport >= POSITION_REPORT_FRAMES) {
      this.lastReport = currentFrame;
      const pos = currentFrame >= this.loopStart ? ((currentFrame - this.loopStart) % this.loopLength) / this.loopLength : 0;
      this.port.postMessage({ type: 'position', phase: pos });
    }
    return true;
  }
}
registerProcessor('looper-processor', LooperProcessor);
`;

export function getLooperWorkletUrl(): string {
  const blob = new Blob([LOOPER_PROCESSOR_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
