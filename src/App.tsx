import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore, currentSection, SEQUENCE_SLOTS, STEPS_PER_SLOT, SECTION_STEPS, type AppState } from '@/store';
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
import { getDB } from '@/db';
import { encodeWav, mixdown, resample } from '@/audio/wav';
import type { LoopSnapshot } from '@/audio/looper';
import { directionLabel } from '@/music/chord-engine';
import { getPatternsForGenre } from '@/data/drum-patterns';
import '@/styles/global.css';

export { stateToPreset, applyPresetToStore } from '@/data/preset-state';

const DRUM_MODES = new Set(['drum', 'drumLoops', 'autoDrum']);
const DRUM_DEGREE_MAP: DrumSound[] = ['kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH'];

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
  /** Track indices in the order they were recorded (for undo). */
  const recordOrderRef = useRef<number[]>([]);
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
  const audioLatency = useAppStore((s) => s.audioLatency);
  /** Bumped whenever the audio engine is (re)built, so engine-bound effects re-attach. */
  const [engineGen, setEngineGen] = useState(0);

  // --- Engine lifecycle -----------------------------------------------------

  useEffect(() => {
    const latency = useAppStore.getState().audioLatency;
    const engine = new AudioEngine(undefined, latency === 'lowest' ? 0 : latency === 'safe' ? 'playback' : 'interactive');
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
    // Everything the per-setting effects below would push, so a rebuilt engine
    // (e.g. after changing the latency setting) sounds exactly like the old one.
    engine.setMasterVolume(s.volume);
    engine.setBpm(s.bpm);
    engine.setSynthMode(s.synthMode);
    engine.setWaveform(s.waveform);
    engine.setAdsr(s.adsr);
    engine.setFmPresetIndex(s.fmPresetIndex);
    engine.setReverbType(s.reverbType);
    for (const [type, fx] of Object.entries(s.effects)) engine.setEffect(type as keyof typeof s.effects, fx.enabled, fx.value);
    engine.setMixLevel('synth', s.mix.synth);
    engine.setMixLevel('beat', s.mix.beat);
    engine.setMixLevel('loops', s.mix.loops);
    if (s.synthMode === 'sample') engine.setSampleName(s.sampleName);
    const handler = playModeHandlerRef.current!;
    handler.setMode(s.playMode);
    handler.setStrumSpeed(s.strumSpeed);
    handler.setArpSettings(s.arpPattern, s.arpRate, s.arpChordMode);
    transportClock.setSwing(s.beatSwing);
    drums.setKit(s.drumKit);
    setEngineGen((g) => g + 1);
    const reportLatency = () => useAppStore.setState({ measuredLatencyMs: engine.getLatencyMs() });
    reportLatency();
    const latencyTimer = setTimeout(reportLatency, 1500);
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
      void restoreLoops(looper, ctx);
    }).catch(() => { /* AudioWorklet unavailable — looper disabled */ });

    void loadUserKit(drums, ctx);

    if (import.meta.env.DEV) {
      // Debug handle for poking the engine from the console / browser tests.
      (window as unknown as { __hichord?: unknown }).__hichord = { engine, drums, looperRef, store: useAppStore };
    }

    // Browsers start audio suspended until a user gesture; unlock on the first touch/key.
    const unlock = () => { void engine.resume().then(reportLatency); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      unsubscribeLooper?.();
      for (const clock of [arpClock, transportClock, metronomeClock]) clock.stop();
      for (const t of uiTimersRef.current) clearTimeout(t);
      clearTimeout(latencyTimer);
      looperRef.current = null;
      engine.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioLatency]);

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

  /**
   * Plays the newest held key's chord.
   * - 'press': a key went down → fresh attack (arp/repeat keep their rhythm instead).
   * - 'pad' / 'fallback': the pad moved, or the newest key was released while an
   *   older one is still held → change smoothly (sustained sounds morph, no re-attack).
   */
  const soundHeldChord = useCallback((why: 'press' | 'pad' | 'fallback') => {
    const handler = playModeHandlerRef.current;
    const degree = heldRef.current[heldRef.current.length - 1];
    if (!handler || degree === undefined) return;
    const chord = buildChord(degree, directionRef.current, lastLiveChordRef);
    const clockDriven = handler.getMode() === 'arpeggio' || handler.getMode() === 'repeat';
    if (why === 'press' && (heldRef.current.length === 1 || !clockDriven)) {
      handler.handleChordDown(chord);
    } else {
      handler.updateChord(chord);
    }
    showChord(chord);
    midiRef.current.releaseAll();
    midiRef.current.sendChord(chord);
  }, [buildChord, showChord]);

  /**
   * The half-bar slot nearest to "now" on the transport grid, i.e. where a
   * chord played right now belongs. A press slightly early for the next slot
   * lands on it, a press slightly late stays on the current one.
   */
  const currentSlotPosition = (): number | null => {
    const ctx = engineRef.current?.getContext();
    const origin = gridOriginRef.current;
    if (!ctx || origin === null) return null;
    const stepDur = 60 / useAppStore.getState().bpm / 4;
    const steps = (ctx.currentTime - origin) / stepDur;
    if (steps < -STEPS_PER_SLOT / 2) return null;
    return ((Math.round(steps / STEPS_PER_SLOT) % SEQUENCE_SLOTS) + SEQUENCE_SLOTS) % SEQUENCE_SLOTS;
  };

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
    soundHeldChord('press');

    state.pushRecentChord({ degree, direction: directionRef.current });

    // Live recording: while the transport runs, snap the press to the nearest half-bar slot.
    if (state.seqRecording && state.transportPlaying && !state.songMode) {
      const slot = currentSlotPosition();
      if (slot !== null) {
        state.setSequenceSlot(slot, { degree, direction: directionRef.current });
        lastWrittenSlotRef.current = slot;
      }
      return;
    }

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
      soundHeldChord('fallback');
    }
  }, [soundHeldChord]);

  const handleDirection = useCallback((dir: JoystickDirection) => {
    const prevDir = directionRef.current;
    directionRef.current = dir;
    useAppStore.getState().setJoystickDirection(dir);
    if (dir === prevDir || heldRef.current.length === 0) return;
    soundHeldChord('pad');
    // Sliding the pad right after entering a sequence step refines that step.
    const slot = lastWrittenSlotRef.current;
    const degree = heldRef.current[heldRef.current.length - 1];
    if (slot !== null && degree !== undefined && dir !== 'center') {
      useAppStore.getState().setSequenceSlot(slot, { degree, direction: dir });
    }
    if (degree !== undefined && dir !== 'center') {
      useAppStore.getState().updateRecentChord({ degree, direction: dir });
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

  const lockGestureRef = useRef(false);
  const handleFunctionButton = useCallback((btn: 'gray' | 'yellow' | 'red', down: boolean) => {
    const state = useAppStore.getState();
    state.setHeldFunctionButton(btn, down);
    // Like the hardware: hold a chord + pad, tap SOUND (E) = chord lock.
    if (btn === 'yellow' && down && heldRef.current.length > 0) {
      lockGestureRef.current = true;
      handleChordLockRef.current();
      return;
    }
    if (!down) {
      if (btn === 'yellow' && lockGestureRef.current) {
        lockGestureRef.current = false;
        return;
      }
      state.setActiveOverlay(state.activeOverlay === btn ? null : btn);
    }
  }, []);
  const handleChordLockRef = useRef<() => void>(() => {});

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
      startStep = aligned.step;
    } else {
      startAt = ctx.currentTime + 0.05;
      gridOriginRef.current = startAt;
    }
    lastSeqChordRef.current = null;

    /** Chord slot at an absolute slot index on the timeline (song chain or looped section). */
    const slotAt = (st: AppState, globalSlot: number) => {
      if (st.songMode) {
        const section = st.songChain[Math.floor(globalSlot / SEQUENCE_SLOTS) % st.songChain.length] ?? 0;
        return st.sections[section]?.[globalSlot % SEQUENCE_SLOTS] ?? null;
      }
      return currentSection(st)[globalSlot % SEQUENCE_SLOTS] ?? null;
    };

    const unsubscribe = clock.onTick((time, rawStep) => {
      const s = useAppStore.getState();
      const step = rawStep % SECTION_STEPS;
      if (rawStep % 2 === 0) atAudioTime(time, () => useAppStore.getState().setTransportStep(step));

      if (step === 0 || rawStep === startStep) {
        const section = s.songMode
          ? s.songChain[Math.floor(rawStep / SECTION_STEPS) % s.songChain.length] ?? 0
          : s.editSection;
        atAudioTime(time, () => useAppStore.getState().setPlayingSection(section));
      }

      if (s.beatEnabled) {
        const beatStep = rawStep % 16;
        const sectionIdx = s.songMode
          ? s.songChain[Math.floor(rawStep / SECTION_STEPS) % s.songChain.length] ?? 0
          : s.editSection;
        const genre = getPatternsForGenre(s.beatGenre);
        const variation = s.sectionBeats[sectionIdx];
        let hits = variation !== null && variation !== undefined ? genre[variation]?.hits ?? s.beatHits : s.beatHits;
        const barInSection = Math.floor(step / 16);
        if (s.autoFills) {
          // Fill in the 4th bar of each section pass, crash into the next one.
          if (barInSection === 3) {
            // Groove for the first half of the bar, then a tom run from high to low.
            const fill = (genre.find((pt) => pt.variation === 'Fills')?.hits ?? []).filter((h) => h.step >= 8);
            const toms = fill.filter((h) => h.sound === 'tom').sort((a, b) => a.step - b.step);
            const run = toms.map((h, i) => ({
              ...h, sound: (i < toms.length / 3 ? 'tomHigh' : i < (2 * toms.length) / 3 ? 'tom' : 'tomLow') as DrumSound,
            }));
            hits = [...hits.filter((h) => h.step < 8), ...fill.filter((h) => h.sound !== 'tom'), ...run];
          }
          if (step === 0 && rawStep > 0) drumEngineRef.current?.triggerDrum('crash', time, 0.8);
        }
        for (const hit of hits) {
          if (hit.step === beatStep) drumEngineRef.current?.triggerDrum(hit.sound, time, hit.velocity);
        }
      }

      if (s.sequenceEnabled && rawStep % STEPS_PER_SLOT === 0) {
        const globalSlot = rawStep / STEPS_PER_SLOT;
        const slot = slotAt(s, globalSlot);
        // While live-recording, the chord being held is already sounding — don't double it.
        if (slot && !(s.seqRecording && heldRef.current.length > 0)) {
          // Hold until the next filled slot (empty slots tie the chord over).
          const horizon = SEQUENCE_SLOTS * (s.songMode ? s.songChain.length : 1);
          let slots = 1;
          while (slots < horizon && !slotAt(s, globalSlot + slots)) slots++;
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
      useAppStore.getState().setPlayingSection(null);
    };
  }, [transportPlaying, atAudioTime, buildChord, showChord, nextGridTime, engineGen]);

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
  }, [playMode, engineGen]);

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

  // --- Loop persistence (IndexedDB) and WAV export ---------------------------------

  const LOOPS_KEY = 'looper-v1';
  interface SavedLoops extends LoopSnapshot { sampleRate: number; bpm: number; bars: number }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Saves the looper's audio shortly after it changes (debounced). */
  const persistLoops = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const looper = looperRef.current;
      const engine = engineRef.current;
      const db = getDB();
      if (!looper || !engine || !db) return;
      try {
        const snap = await looper.exportTracks();
        if (!snap.tracks.some(Boolean)) {
          await db.deleteValue(LOOPS_KEY);
          return;
        }
        const s = useAppStore.getState();
        const saved: SavedLoops = { ...snap, sampleRate: engine.getContext().sampleRate, bpm: s.bpm, bars: s.looperBars };
        await db.putValue(LOOPS_KEY, saved);
      } catch {
        useAppStore.getState().showToast('Could not save loops (storage full?)');
      }
    }, 400);
  }, []);

  async function restoreLoops(looper: LooperController, ctx: BaseAudioContext) {
    const db = getDB();
    if (!db) return;
    try {
      const saved = await db.getValue<SavedLoops>(LOOPS_KEY);
      if (!saved || !saved.tracks.some(Boolean)) return;
      const tracks = saved.tracks.map((t) => t && {
        ...t,
        left: resample(t.left, saved.sampleRate, ctx.sampleRate),
        right: resample(t.right, saved.sampleRate, ctx.sampleRate),
      });
      const loopLength = tracks.find(Boolean)!.left.length;
      looper.importTracks({ loopLength, tracks });
      // Loops dictate the tempo: set it before the tracks lock it.
      useAppStore.setState({ bpm: saved.bpm, looperBars: saved.bars });
      const s = useAppStore.getState();
      tracks.forEach((t, i) => s.setLooperTrack(i, { state: t ? (t.muted ? 'muted' : 'playing') : 'empty', gain: t?.gain ?? 1, pan: t?.pan ?? 0 }));
      recordOrderRef.current = tracks.flatMap((t, i) => (t ? [i] : []));
      const firstEmpty = tracks.findIndex((t) => !t);
      s.setActiveTrack(firstEmpty >= 0 ? firstEmpty : 0);
      s.showToast(`Restored ${tracks.filter(Boolean).length} loop layer(s) — ▶ to play`);
    } catch { /* nothing saved / unreadable */ }
  }

  async function loadUserKit(drums: DrumEngine, ctx: BaseAudioContext) {
    const db = getDB();
    if (!db) return;
    try {
      const names = (await db.listSampleNames()).filter((n) => n.startsWith('kit:'));
      const sounds: DrumSound[] = [];
      for (const name of names) {
        const data = await db.loadSample(name);
        const buffer = await ctx.decodeAudioData(data.slice(0));
        const sound = name.slice(4) as DrumSound;
        drums.setUserSample(sound, buffer);
        sounds.push(sound);
      }
      useAppStore.getState().setUserKitSounds(sounds);
    } catch { /* no user kit */ }
  }

  const handleExportLoops = useCallback(async (repeats: number) => {
    const looper = looperRef.current;
    const engine = engineRef.current;
    const s = useAppStore.getState();
    if (!looper || !engine) return;
    const snap = await looper.exportTracks();
    if (!snap.tracks.some(Boolean)) {
      s.showToast('Nothing to export yet — record a loop first');
      return;
    }
    const { left, right } = mixdown(snap.tracks, snap.loopLength, repeats);
    const blob = encodeWav(left, right, engine.getContext().sampleRate);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hichord-${s.key}-${s.bpm}bpm-${s.looperBars * repeats}bars.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    s.showToast('WAV exported');
  }, []);

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
        recordOrderRef.current = [...recordOrderRef.current.filter((i) => i !== e.trackIndex), e.trackIndex];
        persistLoops();
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
    persistLoops();
  }, [persistLoops]);

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
    persistLoops();
  }, [stopMetronome, persistLoops]);

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
    persistLoops();
  }, [stopMetronome, persistLoops]);

  const handleTrackMix = useCallback((trackIndex: number, update: { gain?: number; pan?: number }) => {
    const looper = looperRef.current;
    if (!looper) return;
    if (update.gain !== undefined) looper.setTrackGain(trackIndex, update.gain);
    if (update.pan !== undefined) looper.setTrackPan(trackIndex, update.pan);
    useAppStore.getState().setLooperTrack(trackIndex, update);
    persistLoops();
  }, [persistLoops]);

  /** Removes the most recently recorded layer. */
  const handleLooperUndo = useCallback(() => {
    const s = useAppStore.getState();
    const withAudio = new Set(s.looperTracks.filter((t) => t.state === 'playing' || t.state === 'muted').map((t) => t.index));
    while (recordOrderRef.current.length > 0 && !withAudio.has(recordOrderRef.current[recordOrderRef.current.length - 1]!)) {
      recordOrderRef.current.pop();
    }
    const last = recordOrderRef.current.pop();
    if (last === undefined) {
      s.showToast('Nothing to undo');
      return;
    }
    handleLooperTrackClear(last);
    s.setActiveTrack(last);
    s.showToast(`Removed track ${last + 1}`);
  }, [handleLooperTrackClear]);

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
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || synthMode !== 'sample') return;
    if (engine.isInstrumentReady(sampleName)) {
      engine.setSampleName(sampleName);
      return;
    }
    // Rendering takes a moment; let the "loading" message paint first.
    useAppStore.getState().showToast(`Loading ${sampleName.toUpperCase()}…`);
    const t = setTimeout(() => engine.setSampleName(sampleName), 40);
    return () => clearTimeout(t);
  }, [sampleName, synthMode]);

  // Pre-render the likely instruments while the app is idle, so picking them is instant.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const queue = [useAppStore.getState().sampleName, 'piano', 'strings', 'keys'];
    const idle = (cb: () => void) => ('requestIdleCallback' in window
      ? (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
      : setTimeout(cb, 500));
    let cancelled = false;
    const next = () => {
      const name = queue.shift();
      if (!name || cancelled) return;
      engine.prepareInstrument(name);
      idle(next);
    };
    const t = setTimeout(() => idle(next), 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, settings] of Object.entries(effects)) {
      engine.setEffect(type as keyof typeof effects, settings.enabled, settings.value);
    }
  }, [effects]);

  // --- Groove, mix, MIDI ---------------------------------------------------------

  const reverbType = useAppStore((s) => s.reverbType);
  useEffect(() => { engineRef.current?.setReverbType(reverbType); }, [reverbType]);

  const beatSwing = useAppStore((s) => s.beatSwing);
  useEffect(() => { transportClockRef.current?.setSwing(beatSwing); }, [beatSwing]);

  const mix = useAppStore((s) => s.mix);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMixLevel('synth', mix.synth);
    engine.setMixLevel('beat', mix.beat);
    engine.setMixLevel('loops', mix.loops);
  }, [mix]);

  const midiEnabled = useAppStore((s) => s.midiEnabled);
  const midiOutputId = useAppStore((s) => s.midiOutputId);
  useEffect(() => {
    const midi = midiRef.current;
    const s = useAppStore.getState();
    if (!midiEnabled) {
      midi.disable();
      return;
    }
    let cancelled = false;
    const refresh = () => {
      const outputs = midi.getOutputs().map((o) => ({ id: o.id, name: o.name ?? o.id }));
      useAppStore.getState().setMidiOutputs(outputs);
      const wanted = useAppStore.getState().midiOutputId;
      const pick = outputs.find((o) => o.id === wanted) ?? outputs[0];
      if (pick) midi.selectOutput(pick.id);
    };
    midi.init().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        s.showToast('MIDI is not available in this browser');
        s.setMidiEnabled(false);
        return;
      }
      refresh();
      midi.onDevicesChanged(refresh);
      if (midi.getOutputs().length === 0) s.showToast('MIDI on — no output devices found yet');
    });
    return () => { cancelled = true; };
  }, [midiEnabled, midiOutputId]);

  // --- User drum kit -------------------------------------------------------------

  const handleUserSample = useCallback(async (sound: DrumSound, file: File | null) => {
    const drums = drumEngineRef.current;
    const engine = engineRef.current;
    const s = useAppStore.getState();
    if (!drums || !engine) return;
    const db = getDB();
    try {
      if (!file) {
        drums.setUserSample(sound, null);
        await db?.deleteSample(`kit:${sound}`);
        s.setUserKitSounds(s.userKitSounds.filter((x) => x !== sound));
        return;
      }
      const data = await file.arrayBuffer();
      const buffer = await engine.getContext().decodeAudioData(data.slice(0));
      drums.setUserSample(sound, buffer);
      await db?.saveSample(`kit:${sound}`, data);
      s.setUserKitSounds([...new Set([...s.userKitSounds, sound])]);
      s.setDrumKit('user');
      drums.triggerDrum(sound);
    } catch {
      s.showToast('Could not read that audio file');
    }
  }, []);

  // --- Chord lock ------------------------------------------------------------------

  /** Locks the held chord key to the pad's current colour (or unlocks it). */
  const handleChordLock = useCallback(() => {
    const s = useAppStore.getState();
    const degree = heldRef.current[heldRef.current.length - 1];
    if (degree === undefined) {
      s.showToast('Hold a chord key, move the pad, then tap LOCK');
      return;
    }
    const existing = s.chordLocks.find((l) => l.degree === degree);
    if (existing) {
      s.toggleChordLock(degree, existing.direction);
      s.showToast('Unlocked');
      return;
    }
    if (directionRef.current === 'center') {
      s.showToast('Move the pad to pick a colour to lock');
      return;
    }
    s.toggleChordLock(degree, directionRef.current);
    s.showToast(`Locked to ${directionLabel(directionRef.current, s.joystickMode)} — no pad needed`);
  }, []);
  handleChordLockRef.current = handleChordLock;

  // --- Vocoder -------------------------------------------------------------------

  const vocoderStreamRef = useRef<MediaStream | null>(null);
  const vocoderSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vocoderMicOn = useAppStore((s) => s.vocoderMicOn);
  const vocoderFormant = useAppStore((s) => s.vocoderFormant);
  const vocoderGate = useAppStore((s) => s.vocoderGate);

  const stopVocoderMic = useCallback(() => {
    vocoderSourceRef.current?.disconnect();
    vocoderSourceRef.current = null;
    vocoderStreamRef.current?.getTracks().forEach((t) => t.stop());
    vocoderStreamRef.current = null;
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const active = playMode === 'vocoder';
    engine.setVocoderActive(active);
    if (!active) {
      stopVocoderMic();
      if (useAppStore.getState().vocoderMicOn) useAppStore.getState().setVocoder({ vocoderMicOn: false });
    }
  }, [playMode, stopVocoderMic, engineGen]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || playMode !== 'vocoder') return;
    if (!vocoderMicOn) {
      stopVocoderMic();
      return;
    }
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        vocoderStreamRef.current = stream;
        vocoderSourceRef.current = engine.getVocoder().connectMicSource(stream);
      })
      .catch(() => {
        useAppStore.getState().showToast('Microphone access denied');
        useAppStore.getState().setVocoder({ vocoderMicOn: false });
      });
    return () => { cancelled = true; };
  }, [vocoderMicOn, playMode, stopVocoderMic, engineGen]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || playMode !== 'vocoder') return;
    engine.getVocoder().setFormantShift(vocoderFormant);
    engine.getVocoder().setGateThreshold(vocoderGate);
  }, [vocoderFormant, vocoderGate, playMode, engineGen]);

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

  const getAudioContext = useCallback(() => (engineRef.current?.getContext() as AudioContext | undefined) ?? null, []);

  const centerAreaProps: CenterAreaProps = {
    drumViewProps: {
      onTriggerDrum: handleTriggerDrum,
      onHoldChange: handleDrumHoldChange,
      onToggleTransport: toggleTransport,
      onUserSample: (sound: DrumSound, file: File | null) => void handleUserSample(sound, file),
    },
    looperViewProps: {
      onRecordToggle: handleLooperRecordToggle,
      onStop: handleLooperStop,
      onPlayToggle: handleLooperPlayToggle,
      onTrackMuteToggle: handleLooperTrackMute,
      onTrackClear: handleLooperTrackClear,
      onClearAll: handleLooperClearAll,
      onExport: (repeats: number) => void handleExportLoops(repeats),
      onTrackMix: handleTrackMix,
      onUndo: handleLooperUndo,
    },
    sequencerGridProps: {
      onToggleTransport: toggleTransport,
    },
    onChordTrigger: handleGameChordTrigger,
    onSampleCaptured: handleSampleCaptured,
    getAudioContext,
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
      onChordLock={handleChordLock}
    />
  );
}
