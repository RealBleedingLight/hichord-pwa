// This file is loaded as an AudioWorklet module
const LOOPER_PROCESSOR_CODE = `
class LooperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tracks = [];
    for (let i = 0; i < 6; i++) {
      this.tracks.push({
        buffer: null,
        length: 0,
        position: 0,
        recording: false,
        playing: false,
        gain: 1.0,
        muted: false,
      });
    }
    this.loopLength = 0;
    this.globalPosition = 0;
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'startRecord': {
        const track = this.tracks[msg.trackIndex];
        track.buffer = new Float32Array(msg.loopLength);
        track.length = msg.loopLength;
        track.position = 0;
        track.recording = true;
        track.playing = false;
        if (msg.trackIndex === 0) this.loopLength = msg.loopLength;
        break;
      }
      case 'stopRecord': {
        const track = this.tracks[msg.trackIndex];
        track.recording = false;
        track.playing = true;
        track.position = 0;
        break;
      }
      case 'play': {
        for (const track of this.tracks) {
          if (track.buffer && !track.recording) {
            track.playing = true;
            track.position = 0;
          }
        }
        this.globalPosition = 0;
        break;
      }
      case 'stop': {
        for (const track of this.tracks) {
          track.playing = false;
          track.recording = false;
        }
        break;
      }
      case 'setGain':
        this.tracks[msg.trackIndex].gain = msg.gain;
        break;
      case 'mute':
        this.tracks[msg.trackIndex].muted = true;
        break;
      case 'unmute':
        this.tracks[msg.trackIndex].muted = false;
        break;
      case 'clearTrack':
        this.tracks[msg.trackIndex].buffer = null;
        this.tracks[msg.trackIndex].playing = false;
        this.tracks[msg.trackIndex].recording = false;
        break;
      case 'clearAll':
        for (const track of this.tracks) {
          track.buffer = null;
          track.playing = false;
          track.recording = false;
        }
        break;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0].length;

    for (let ch = 0; ch < output.length; ch++) {
      output[ch].fill(0);
    }

    for (const track of this.tracks) {
      if (track.recording && track.buffer && input[0]) {
        for (let i = 0; i < blockSize; i++) {
          if (track.position < track.length) {
            track.buffer[track.position] = input[0][i] || 0;
            track.position++;
          }
        }
        if (track.position >= track.length) {
          track.recording = false;
          track.playing = true;
          track.position = 0;
          this.port.postMessage({ type: 'recordingDone', trackIndex: this.tracks.indexOf(track) });
        }
      }

      if (track.playing && track.buffer && !track.muted) {
        for (let i = 0; i < blockSize; i++) {
          const sample = track.buffer[track.position % track.length] * track.gain;
          for (let ch = 0; ch < output.length; ch++) {
            output[ch][i] += sample;
          }
          track.position = (track.position + 1) % track.length;
        }
      }
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
