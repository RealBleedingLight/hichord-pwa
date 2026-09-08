// Polyfills the Web Audio API in the jsdom/node test environment using
// node-web-audio-api's native (Rust) implementation, so tests can create
// real AudioContext/OfflineAudioContext instances and render actual audio
// buffers via startRendering().
import * as WebAudioAPI from 'node-web-audio-api';

const globalAny = globalThis as unknown as Record<string, unknown>;

for (const key of Object.keys(WebAudioAPI)) {
  if (key === 'default' || key === '__esModule' || key === 'AudioContext') continue;
  if (globalAny[key] === undefined) {
    globalAny[key] = (WebAudioAPI as unknown as Record<string, unknown>)[key];
  }
}

// The real `AudioContext` from node-web-audio-api opens an actual system
// audio device, which is unavailable/unreliable in CI/sandboxed test runs.
// Tests that need a "live" context (e.g. AudioEngine's default constructor
// path) get a stand-in backed by OfflineAudioContext instead, so no real
// hardware is touched and rendering is fully deterministic.
class TestAudioContext extends WebAudioAPI.OfflineAudioContext {
  constructor() {
    super(2, 48000, 48000);
  }
}

if (globalAny.AudioContext === undefined) {
  globalAny.AudioContext = TestAudioContext;
}
