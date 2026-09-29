import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore, SEQUENCE_SLOTS, STEPS_PER_SLOT } from '@/store';
import { AudioEngine } from '@/audio/engine';
import { MIDIOutputController } from '@/audio/midi';
import { MasterClock } from '@/audio/clock';
import { Arpeggiator } from '@/audio/arpeggiator';
import { PlayModeHandler } from '@/audio/play-modes';
import { DrumEngine } from '@/audio/drums';
import { LooperController, calculateLoopLength, type LooperEvent } from '@/audio/looper';
import { getChord } from '@/music/chord-engine';
import { selectVoiceLeading } from '@/music/voice-leading';
import { KeyboardHandler } from '@/input/keyboard-handler';
import type { ScaleDegree, JoystickDirection, ChordVoicing } from '@/music/types';
import type { DrumSound } from '@/audio/types';
import type { CenterAreaProps } from '@/components/CenterArea';
import '@/styles/global.css';

export { stateToPreset, applyPresetToStore } from '@/data/preset-state';

const DRUM_MODES = new Set(['drum', 'drumLoops', 'autoDrum']);
const DRUM_DEGREE_MAP: DrumSound[] = ['kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH'];
/** Transport steps (16ths) in one full pass of the chord sequence (4 bars). */
const SEQUENCE_STEPS = SEQUENCE_SLOTS * STEPS_PER_SLOT;

function midiFromFrequency(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/** Drops leading silence from a mic take so it plays the instant a key is pressed. */
function trimLeadingSilence(buffer: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0;
  while (start < data.length && Math.abs(data[start]!) < 0.02) start++;
  start = Math.max(0, start - Math.floor(buffer.sampleRate * 0.005));
  const maxLen = Math.floor(buffer.sampleRate * 3);
  const len = Math.max(1, Math.min(maxLen, data.length - start));
  const out = ctx.createBuffer(1, len, buffer.sampleRate);
  out.getChannelData(0).set(data.subarray(start, start + len));
  return out;
}

/** Keeps voice-led chords from wandering out of the intended register. */
function withinRegister(chord: ChordVoicing, reference: ChordVoicing): boolean {
  const avg = (c: ChordVoicing) => c.notes.reduce((a, n) => a + n.midi, 0) / Math.max(1, c.notes.length);
  return Math.abs(avg(chord) - avg(reference)) <= 7;
}

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const arpClockRef = useRef<MasterClock | null>(null);
  const transportClockRef = useRef<MasterClock | null>(null);
  const metronomeClockRef = useRef<MasterClock | null>(null);
  const playModeHandlerRef = useRef<PlayModeHandler | null>(null);
  const drumEngineRef = useRef<DrumEngine | null>(null);
  const looperRef = useRef<LooperController | null>(null);
  const midiRef = useRef<MIDIOutputController>(new MIDIOutputController());

  /** Keys currently held, oldest first. The newest one is the chord that sounds. */
  const heldRef = useRef<ScaleDegree[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<ScaleDegree>>(new Set());
  const directionRef = useRef<JoystickDirection>('center');
  const lastLiveChordRef = useRef<ChordVoicing | null>(null);
  const lastSeqChordRef = useRef<ChordVoicing | null>(null);
  const lastWrittenSlotRef = useRef<number | null>(null);
  const heldAutoDrumSoundsRef = useRef<Set<DrumSound>>(new Set());

  /** A downbeat time (AudioContext seconds) that the beat, sequence and loops all line up to. */
  const gridOriginRef = useRef<number | null>(null);
  const recordingTrackRef = useRef<number | null>(null);
  const uiTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const drumKit = useAppStore((s) => s.drumKit);
  const playMode = useAppStore((s) => s.playMode);
  const strumSpeed = useAppStore((s) => s.strumSpeed);
  const arpPattern = useAppStore((s) => s.arpPattern);
  const arpRate = useAppStore((s) => s.arpRate);
  const arpChordMode = useAppStore((s) => s.arpChordMode);
  const bpm = useAppStore((s) => s.bpm);
  const synthMode = useAppStore((s) => s.synthMode);
  const waveform = useAppStore((s) => s.waveform);
  const adsr = useAppStore((s) => s.adsr);
  const fmPresetIndex = useAppStore((s) => s.fmPresetIndex);
  const sampleName = useAppStore((s) => s.sampleName);
  const effects = useAppStore((s) => s.effects);
  const volume = useAppStore((s) => s.volume);
  const transportPlaying = useAppStore((s) => s.transportPlaying);
  const joystickDirection = useAppStore((s) => s.joystickDirection);
  const joystickMode = useAppStore((s) => s.joystickMode);

  // --- Engine lifecycle -----------------------------------------------------

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    const ctx = engine.getContext();
    const arpClock = new MasterClock(ctx);
    const transportClock = new MasterClock(ctx);
    transportClock.setRate('1/16');
    const metronomeClock = new MasterClock(ctx);
    metronomeClock.setRate('1/4');
    arpClockRef.current = arpClock;
    transportClockRef.current = transportClock;
    metronomeClockRef.current = metronomeClock;
    playModeHandlerRef.current = new PlayModeHandler(engine, arpClock, new Arpeggiator());

    const drums = new DrumEngine(ctx, engine.getDrumBus());
    drumEngineRef.current = drums;

    // Push the current (possibly restored) store state into the fresh engine.
    const s = useAppStore.getState();
    engine.setMasterVolume(s.volume);
    engine.setBpm(s.bpm);
    drums.setKit(s.drumKit);
    for (const clock of [arpClock, transportClock, metronomeClock]) clock.setBpm(s.bpm);

    let disposed = false;
    const looper = new LooperController(ctx as AudioContext);
    let unsubscribeLooper: (() => void) | null = null;
    void looper.init().then(() => {
      if (disposed) return;
      looper.connectInput(engine.getMixBus());
      looper.connectOutput(engine.getLooperReturn());
      looperRef.current = looper;
      unsubscribeLooper = looper.onEvent(handleLooperEvent);
    }).catch(() => { /* AudioWorklet unavailable — looper disabled */ });

    midiRef.current.init().catch(() => { /* Web MIDI unavailable — no-op */ });

    if (import.meta.env.DEV) {
      // Debug handle for poking the engine from the console / browser tests.
      (window as unknown as { __hichord?: unknown }).__hichord = { engine, drums, looperRef, store: useAppStore };
    }

    // Browsers start audio suspended until a user gesture; unlock on the first touch/key.
    const unlock = () => { void engine.resume(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      unsubscribeLooper?.();
      for (const clock of [arpClock, transportClock, metronomeClock]) clock.stop();
      for (const t of uiTimersRef.current) clearTimeout(t);
      looperRef.current = null;
      engine.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Runs `fn` when AudioContext time `time` is actually heard, so the UI matches the audio. */
  const atAudioTime = useCallback((time: number, fn: () => void) => {
    const ctx = engineRef.current?.getContext();
    const delay = ctx ? Math.max(0, (time - ctx.currentTime) * 1000) : 0;
    const t = setTimeout(() => { uiTimersRef.current.delete(t); fn(); }, delay);
    uiTimersRef.current.add(t);
  }, []);

  // --- Chords -----------------------------------------------------------------

  const buildChord = useCallback((degree: ScaleDegree, direction: JoystickDirection, leadRef: { current: ChordVoicing | null }) => {
    const s = useAppStore.getState();
    const octave = 4 + s.globalOctave + (s.buttonOctaves[degree - 1] ?? 0);
    const base = getChord(
      s.key, s.scale, degree, octave, direction, s.joystickMode,
      s.inversions[degree - 1] ?? 0, s.bassMode, s.chordLocks,
    );
    let chord = base;
    const prev = leadRef.current;
    if (s.voiceLeading && prev) {
      const led = selectVoiceLeading(prev, base);
      if (withinRegister(led, base)) chord = led;
    }
    leadRef.current = chord;
    return chord;
  }, []);

  const showChord = useCallback((chord: ChordVoicing) => {
    const midi = [...(chord.bass ? [chord.bass.midi] : []), ...chord.notes.map((n) => n.midi)];
    useAppStore.getState().setCurrentChord(chord.displayName, midi);
  }, []);

  /** Plays the newest held key's chord (on key down, legato change, or pad move). */
  const soundHeldChord = useCallback((isNewPress: boolean) => {
    const handler = playModeHandlerRef.current;
    const degree = heldRef.current[heldRef.current.length - 1];
    if (!handler || degree === undefined) return;
    const chord = buildChord(degree, directionRef.current, lastLiveChordRef);
    if (isNewPress && heldRef.current.length === 1) {
      handler.handleChordDown(chord);
    } else {
      handler.updateChord(chord);
    }
    showChord(chord);
    midiRef.current.releaseAll();
    midiRef.current.sendChord(chord);
  }, [buildChord, showChord]);

  const triggerChord = useCallback((degree: ScaleDegree) => {
    const engine = engineRef.current;
    if (!engine || !playModeHandlerRef.current) return;
    void engine.resume();

    const state = useAppStore.getState();
    // In drum modes, chord keys play drums instead.
    if (DRUM_MODES.has(state.playMode)) {
      const sound = DRUM_DEGREE_MAP[degree - 1];
      if (sound) drumEngineRef.current?.triggerDrum(sound);
      return;
    }

    heldRef.current = [...heldRef.current.filter((d) => d !== degree), degree];
    setActiveKeys(new Set(heldRef.current));
    soundHeldChord(true);

    // Step entry: with a sequence slot selected, pressing a chord writes it there.
    if (state.playMode === 'sequencer' && state.selectedSlot !== null) {
      const slot = state.selectedSlot;
      state.setSequenceSlot(slot, { degree, direction: directionRef.current });
      lastWrittenSlotRef.current = slot;
      state.setSelectedSlot(slot + 1 < SEQUENCE_SLOTS ? slot + 1 : null);
    }
  }, [soundHeldChord]);

  const releaseChord = useCallback((degree: ScaleDegree) => {
    if (!heldRef.current.includes(degree)) return;
    const wasSounding = heldRef.current[heldRef.current.length - 1] === degree;
    heldRef.current = heldRef.current.filter((d) => d !== degree);
    setActiveKeys(new Set(heldRef.current));

    if (heldRef.current.length === 0) {
      lastWrittenSlotRef.current = null;
      playModeHandlerRef.current?.handleChordUp();
      if (useAppStore.getState().playMode !== 'drone') midiRef.current.releaseAll();
    } else if (wasSounding) {
      // Legato: fall back to the key that's still held instead of going silent.
      soundHeldChord(false);
    }
  }, [soundHeldChord]);

  const handleDirection = useCallback((dir: JoystickDirection) => {
    const prevDir = directionRef.current;
    directionRef.current = dir;
    useAppStore.getState().setJoystickDirection(dir);
    if (dir === prevDir || heldRef.current.length === 0) return;
    soundHeldChord(false);
    // Sliding the pad right after entering a sequence step refines that step.
    const slot = lastWrittenSlotRef.current;
    const degree = heldRef.current[heldRef.current.length - 1];
    if (slot !== null && degree !== undefined && dir !== 'center') {
      useAppStore.getState().setSequenceSlot(slot, { degree, direction: dir });
    }
  }, [soundHeldChord]);

  const handleVolume = useCallback((vol: number) => {
    useAppStore.getState().setVolume(vol);
    engineRef.current?.setMasterVolume(vol);
  }, []);

  const handleVolumeDelta = useCallback((delta: number) => {
    const state = useAppStore.getState();
    handleVolume(Math.max(0, Math.min(1, state.volume + delta)));
  }, [handleVolume]);

  const handleFunctionButton = useCallback((btn: 'gray' | 'yellow' | 'red', down: boolean) => {
    const state = useAppStore.getState();
    state.setHeldFunctionButton(btn, down);
    if (!down) {
      state.setActiveOverlay(state.activeOverlay === btn ? null : btn);
    }
  }, []);

  // --- Transport: beat + chord sequence on one 16th-note clock -----------------

  const stepSeconds = () => 60 / useAppStore.getState().bpm / 4;

  /** Next time on the shared grid that is a multiple of `unitSteps` 16ths from the origin. */
  const nextGridTime = useCallback((unitSteps: number, lead = 0.04): { time: number; step: number } | null => {
    const ctx = engineRef.current?.getContext();
    const origin = gridOriginRef.current;
    if (!ctx || origin === null) return null;
    const now = ctx.currentTime + lead;
    const unit = stepSeconds() * unitSteps;
    const n = Math.max(0, Math.ceil((now - origin) / unit - 1e-6));
    return { time: origin + n * unit, step: n * unitSteps };
  }, []);

  const hasLoopAudio = () => useAppStore.getState().looperTracks.some((t) => t.state === 'playing' || t.state === 'muted');

  useEffect(() => {
    const clock = transportClockRef.current;
    const engine = engineRef.current;
    const ctx = engine?.getContext();
    if (!clock || !engine || !ctx || !transportPlaying) return;

    void engine.resume();
    const looperRunning = useAppStore.getState().looperState !== 'off' && hasLoopAudio();
    let startAt: number;
    let startStep = 0;
    const aligned = looperRunning ? nextGridTime(1) : null;
    if (aligned) {
      startAt = aligned.time;
      startStep = aligned.step % SEQUENCE_STEPS;
    } else {
      startAt = ctx.currentTime + 0.05;
      gridOriginRef.current = startAt;
    }
    lastSeqChordRef.current = null;

    const unsubscribe = clock.onTick((time, rawStep) => {
      const s = useAppStore.getState();
      const step = rawStep % SEQUENCE_STEPS;
      atAudioTime(time, () => useAppStore.getState().setTransportStep(step));

      if (s.beatEnabled) {
        const beatStep = step % 16;
        for (const hit of s.beatHits) {
          if (hit.step === beatStep) drumEngineRef.current?.triggerDrum(hit.sound, time, hit.velocity);
        }
      }

      if (s.sequenceEnabled && step % STEPS_PER_SLOT === 0) {
        const slotIndex = step / STEPS_PER_SLOT;
        const slot = s.sequence[slotIndex];
        if (slot) {
          // Hold until the next filled slot (empty slots tie the chord over).
          let slots = 1;
          while (slots < SEQUENCE_SLOTS && !s.sequence[(slotIndex + slots) % SEQUENCE_SLOTS]) slots++;
          const chord = buildChord(slot.degree, slot.direction, lastSeqChordRef);
          engine.triggerChord(chord, time, 0, 'seq');
          engine.releaseChord(time + slots * STEPS_PER_SLOT * stepSeconds() * 0.97, 'seq');
          atAudioTime(time, () => { if (heldRef.current.length === 0) showChord(chord); });
        }
      }
    });
    clock.start(startAt, startStep);

    return () => {
      unsubscribe();
      clock.stop();
      engine.stopAll('seq');
      useAppStore.getState().setTransportStep(null);
    };
  }, [transportPlaying, atAudioTime, buildChord, showChord, nextGridTime]);

  const toggleTransport = useCallback(() => {
    const s = useAppStore.getState();
    s.setTransportPlaying(!s.transportPlaying);
  }, []);

  // Auto-drum: held pads retrigger at the arp rate.
  useEffect(() => {
    const clock = arpClockRef.current;
    if (!clock || playMode !== 'autoDrum') return;
    const unsubscribe = clock.onTick((time) => {
      for (const sound of heldAutoDrumSoundsRef.current) {
        drumEngineRef.current?.triggerDrum(sound, time);
      }
    });
    clock.start();
    return () => {
      unsubscribe();
      clock.stop();
    };
  }, [playMode]);

  const handleTriggerDrum = useCallback((sound: DrumSound) => {
    void engineRef.current?.resume();
    drumEngineRef.current?.triggerDrum(sound);
  }, []);

  const handleDrumHoldChange = useCallback((sound: DrumSound, held: boolean) => {
    if (held) heldAutoDrumSoundsRef.current.add(sound);
    else heldAutoDrumSoundsRef.current.delete(sound);
  }, []);

  // --- Looper -------------------------------------------------------------------

  const metronomeUnsubRef = useRef<(() => void) | null>(null);

  const stopMetronome = useCallback(() => {
    metronomeUnsubRef.current?.();
    metronomeUnsubRef.current = null;
    metronomeClockRef.current?.stop();
  }, []);

  /** Clicks quarter notes on the shared grid from `startAt` (count-in + recording guide). */
  const startMetronome = useCallback((startAt: number, startBeat: number) => {
    const clock = metronomeClockRef.current;
    const drums = drumEngineRef.current;
    const engine = engineRef.current;
    if (!clock || !drums || !engine) return;
    stopMetronome();
    metronomeUnsubRef.current = clock.onTick((time, beat) => {
      drums.triggerClick(beat % 4 === 0, time, engine.getMonitorBus());
    });
    clock.start(startAt, startBeat);
  }, [stopMetronome]);

  function handleLooperEvent(e: LooperEvent) {
    const s = useAppStore.getState();
    switch (e.type) {
      case 'recordingDone': {
        s.setLooperTrack(e.trackIndex, { state: 'playing' });
        if (recordingTrackRef.current === e.trackIndex) recordingTrackRef.current = null;
        s.setLooperState('looping');
        stopMetronome();
        const next = useAppStore.getState().looperTracks.find((t) => t.state === 'empty');
        if (next) s.setActiveTrack(next.index);
        s.showToast(`Track ${e.trackIndex + 1} recorded`);
        break;
      }
      case 'recordingCancelled': {
        s.setLooperTrack(e.trackIndex, { state: 'empty' });
        if (recordingTrackRef.current === e.trackIndex) recordingTrackRef.current = null;
        s.setLooperState(hasLoopAudio() ? 'looping' : 'off');
        stopMetronome();
        break;
      }
      case 'position':
        if (s.looperState !== 'off') s.setLooperPhase(e.phase);
        break;
    }
  }

  const handleLooperRecordToggle = useCallback((requestedTrack?: number) => {
    const looper = looperRef.current;
    const engine = engineRef.current;
    const state = useAppStore.getState();
    if (!looper || !engine) {
      state.showToast('Looper unavailable in this browser');
      return;
    }
    void engine.resume();

    // Second press while counting in / recording = stop recording.
    if (state.looperState === 'recording' || state.looperState === 'waiting') {
      if (recordingTrackRef.current !== null) looper.stopRecording(recordingTrackRef.current);
      return;
    }

    const tracks = state.looperTracks;
    const wanted = requestedTrack ?? state.activeTrack;
    const target = tracks[wanted]?.state === 'empty'
      ? wanted
      : tracks.find((t) => t.state === 'empty')?.index;
    if (target === undefined) {
      state.showToast('All 6 tracks are full — clear one first');
      return;
    }

    const ctx = engine.getContext();
    const barSeconds = stepSeconds() * 16;
    const isFirstTrack = !hasLoopAudio();
    let startAt: number;

    if (isFirstTrack) {
      // First loop: start on the next bar of the running beat, or after a 1-bar count-in.
      const onBeat = state.transportPlaying ? nextGridTime(16) : null;
      if (onBeat) {
        startAt = onBeat.time;
      } else {
        startAt = ctx.currentTime + 0.1 + barSeconds;
        gridOriginRef.current = startAt;
        if (state.metronomeOn) startMetronome(startAt - barSeconds, 0);
      }
      const loopLength = calculateLoopLength(state.looperBars, state.bpm, ctx.sampleRate);
      looper.startRecording(target, loopLength, startAt);
      state.setLooperState('waiting');
      atAudioTime(startAt, () => {
        if (recordingTrackRef.current === target) useAppStore.getState().setLooperState('recording');
      });
    } else {
      // Overdub: record one full cycle starting now; the worklet keeps it in phase.
      startAt = ctx.currentTime + 0.02;
      looper.startRecording(target, 0, startAt);
      state.setLooperState('recording');
      if (state.metronomeOn && !state.transportPlaying) {
        const beat = nextGridTime(4);
        if (beat) startMetronome(beat.time, beat.step / 4);
      }
    }
    recordingTrackRef.current = target;
    state.setActiveTrack(target);
    state.setLooperTrack(target, { state: 'recording' });
  }, [atAudioTime, nextGridTime, startMetronome]);

  const handleLooperStop = useCallback(() => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    if (!looper) return;
    looper.stop();
    stopMetronome();
    state.setLooperState('off');
    state.setLooperPhase(0);
  }, [stopMetronome]);

  const handleLooperPlayToggle = useCallback(() => {
    const looper = looperRef.current;
    const engine = engineRef.current;
    const state = useAppStore.getState();
    if (!looper || !engine) return;
    if (state.looperState !== 'off') {
      handleLooperStop();
      return;
    }
    if (!hasLoopAudio()) {
      state.showToast('Nothing recorded yet — press ● to record a loop');
      return;
    }
    void engine.resume();
    const ctx = engine.getContext();
    const onBar = state.transportPlaying ? nextGridTime(16) : null;
    const startAt = onBar ? onBar.time : ctx.currentTime + 0.05;
    if (!onBar) gridOriginRef.current = startAt;
    looper.play(startAt);
    state.setLooperState('looping');
  }, [handleLooperStop, nextGridTime]);

  const handleLooperTrackMute = useCallback((trackIndex: number) => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    const track = state.looperTracks.find((t) => t.index === trackIndex);
    if (!looper || !track) return;
    if (track.state === 'muted') {
      looper.unmuteTrack(trackIndex);
      state.setLooperTrack(trackIndex, { state: 'playing' });
    } else if (track.state === 'playing') {
      looper.muteTrack(trackIndex);
      state.setLooperTrack(trackIndex, { state: 'muted' });
    }
  }, []);

  const handleLooperTrackClear = useCallback((trackIndex: number) => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    if (!looper) return;
    if (recordingTrackRef.current === trackIndex) return;
    looper.clearTrack(trackIndex);
    looper.unmuteTrack(trackIndex);
    state.setLooperTrack(trackIndex, { state: 'empty' });
    if (!hasLoopAudio()) {
      stopMetronome();
      state.setLooperState('off');
      state.setLooperPhase(0);
    }
  }, [stopMetronome]);

  const handleLooperClearAll = useCallback(() => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    if (!looper) return;
    looper.clearAll();
    for (let i = 0; i < 6; i++) {
      looper.unmuteTrack(i);
      state.setLooperTrack(i, { state: 'empty' });
    }
    recordingTrackRef.current = null;
    stopMetronome();
    state.setLooperState('off');
    state.setLooperPhase(0);
    state.setActiveTrack(0);
  }, [stopMetronome]);

  const handleTrackSelect = useCallback((index: number) => {
    useAppStore.getState().setActiveTrack(index);
  }, []);

  // --- Mic sample → playable instrument -----------------------------------------------

  const handleSampleCaptured = useCallback((buffer: AudioBuffer, pitchHz: number | null) => {
    const engine = engineRef.current;
    if (!engine) return;
    const trimmed = trimLeadingSilence(buffer, engine.getContext());
    const rootMidi = pitchHz && pitchHz > 30 && pitchHz < 2000 ? midiFromFrequency(pitchHz) : 60;
    engine.setMicSample(trimmed, rootMidi);
    const s = useAppStore.getState();
    s.setMicSampleAvailable(true);
    s.setSynthMode('sample');
    if (s.sampleName === 'mic') engine.setSampleName('mic');
    else s.setSampleName('mic');
    s.showToast('Sample ready — play the chord keys');
  }, []);

  // --- Store → engine sync ---------------------------------------------------------

  useEffect(() => {
    const handler = playModeHandlerRef.current;
    if (!handler) return;
    handler.setMode(playMode);
    heldRef.current = [];
    setActiveKeys(new Set());
    engineRef.current?.stopAll('live');
    if (playMode !== 'sequencer') useAppStore.getState().setSelectedSlot(null);
  }, [playMode]);

  useEffect(() => { playModeHandlerRef.current?.setStrumSpeed(strumSpeed); }, [strumSpeed]);

  useEffect(() => {
    playModeHandlerRef.current?.setArpSettings(arpPattern, arpRate, arpChordMode);
  }, [arpPattern, arpRate, arpChordMode]);

  useEffect(() => {
    for (const clock of [arpClockRef.current, transportClockRef.current, metronomeClockRef.current]) clock?.setBpm(bpm);
    engineRef.current?.setBpm(bpm);
  }, [bpm]);

  useEffect(() => { drumEngineRef.current?.setKit(drumKit); }, [drumKit]);
  useEffect(() => { engineRef.current?.setSynthMode(synthMode); }, [synthMode]);
  useEffect(() => { engineRef.current?.setWaveform(waveform); }, [waveform]);
  useEffect(() => { engineRef.current?.setAdsr(adsr); }, [adsr]);
  useEffect(() => { engineRef.current?.setFmPresetIndex(fmPresetIndex); }, [fmPresetIndex]);
  useEffect(() => { engineRef.current?.setSampleName(sampleName); }, [sampleName]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, settings] of Object.entries(effects)) {
      engine.setEffect(type as keyof typeof effects, settings.enabled, settings.value);
    }
  }, [effects]);

  // --- Keyboard ------------------------------------------------------------------

  useEffect(() => {
    const keyboardHandler = new KeyboardHandler({
      onChordDown: triggerChord,
      onChordUp: releaseChord,
      onDirection: handleDirection,
      onFunctionButton: handleFunctionButton,
      onCenterTap: toggleTransport,
      onVolumeChange: handleVolumeDelta,
      onTrackToggle: handleTrackSelect,
      onEscape: () => useAppStore.getState().setActiveOverlay(null),
      onHelp: () => {
        const s = useAppStore.getState();
        s.setActiveOverlay(s.activeOverlay === 'help' ? null : 'help');
      },
      onLooperRecord: () => handleLooperRecordToggle(),
    });
    keyboardHandler.attach();
    return () => keyboardHandler.detach();
  }, [triggerChord, releaseChord, handleDirection, handleFunctionButton, toggleTransport, handleVolumeDelta, handleTrackSelect, handleLooperRecordToggle]);

  const handleGameChordTrigger = useCallback((voicing: ChordVoicing) => {
    const engine = engineRef.current;
    if (!engine) return;
    void engine.resume();
    engine.triggerChord(voicing);
    engine.releaseChord(engine.getContext().currentTime + 0.8);
  }, []);

  const getAnalyser = useCallback(() => engineRef.current?.getAnalyser() ?? null, []);

  const centerAreaProps: CenterAreaProps = {
    drumViewProps: {
      onTriggerDrum: handleTriggerDrum,
      onHoldChange: handleDrumHoldChange,
      onToggleTransport: toggleTransport,
    },
    looperViewProps: {
      onRecordToggle: handleLooperRecordToggle,
      onStop: handleLooperStop,
      onPlayToggle: handleLooperPlayToggle,
      onTrackMuteToggle: handleLooperTrackMute,
      onTrackClear: handleLooperTrackClear,
      onClearAll: handleLooperClearAll,
    },
    sequencerGridProps: {
      onToggleTransport: toggleTransport,
    },
    onChordTrigger: handleGameChordTrigger,
    onSampleCaptured: handleSampleCaptured,
    getAnalyser,
  };

  return (
    <Layout
      onKeyDown={triggerChord}
      onKeyUp={releaseChord}
      onDirectionChange={handleDirection}
      onVolumeChange={handleVolume}
      activeKeys={activeKeys}
      volume={volume}
      joystickDirection={joystickDirection}
      joystickMode={joystickMode}
      centerAreaProps={centerAreaProps}
      onToggleTransport={toggleTransport}
      onLooperRecord={() => handleLooperRecordToggle()}
      onLooperPlay={handleLooperPlayToggle}
    />
  );
}
