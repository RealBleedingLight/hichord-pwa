import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore } from '@/store';
import { AudioEngine } from '@/audio/engine';
import { MIDIOutputController } from '@/audio/midi';
import { MasterClock } from '@/audio/clock';
import { Arpeggiator } from '@/audio/arpeggiator';
import { PlayModeHandler } from '@/audio/play-modes';
import { DrumEngine } from '@/audio/drums';
import { LooperController, calculateLoopLength } from '@/audio/looper';
import { Sequencer } from '@/audio/sequencer';
import { getChord } from '@/music/chord-engine';
import { KeyboardHandler } from '@/input/keyboard-handler';
import type { ScaleDegree, JoystickDirection, ChordVoicing } from '@/music/types';
import type { DrumSound, Preset } from '@/audio/types';
import type { DrumPattern } from '@/data/drum-patterns';
import type { CenterAreaProps } from '@/components/CenterArea';
import { HiChordDB } from '@/db';
import { FACTORY_PRESETS } from '@/data/presets';
import '@/styles/global.css';

/**
 * Extracts the current app store state as a Preset, ready to save.
 */
export function stateToPreset(id: string, name: string): Preset {
  const state = useAppStore.getState();
  return {
    id,
    name,
    synthMode: state.synthMode,
    waveform: state.waveform,
    fmPresetIndex: state.fmPresetIndex,
    sampleName: state.sampleName,
    adsr: state.adsr,
    effects: state.effects,
    key: state.key,
    scale: state.scale,
    globalOctave: state.globalOctave,
    buttonOctaves: state.buttonOctaves,
    inversions: state.inversions,
    chordLocks: state.chordLocks,
    bassMode: state.bassMode,
    voiceLeading: state.voiceLeading,
    joystickMode: state.joystickMode,
    drumKit: state.drumKit,
    arpPattern: state.arpPattern,
    arpRate: state.arpRate,
    arpChordMode: state.arpChordMode,
    bpm: state.bpm,
  };
}

/**
 * Applies a loaded Preset's fields onto the app store.
 */
export function applyPresetToStore(preset: Preset): void {
  const state = useAppStore.getState();
  state.setSynthMode(preset.synthMode);
  state.setWaveform(preset.waveform);
  state.setFmPresetIndex(preset.fmPresetIndex);
  state.setSampleName(preset.sampleName);
  state.setAdsr(preset.adsr);
  for (const [type, settings] of Object.entries(preset.effects)) {
    state.setEffect(type as keyof typeof preset.effects, settings);
  }
  state.setKey(preset.key);
  state.setScale(preset.scale);
  state.setGlobalOctave(preset.globalOctave);
  preset.buttonOctaves.forEach((octave, i) => state.setButtonOctave(i, octave));
  preset.inversions.forEach((inv, degree) => state.setInversion(degree, inv));
  state.setBassMode(preset.bassMode);
  state.setVoiceLeading(preset.voiceLeading);
  state.setJoystickMode(preset.joystickMode);
  state.setDrumKit(preset.drumKit);
  state.setArpPattern(preset.arpPattern);
  state.setArpRate(preset.arpRate);
  state.setArpChordMode(preset.arpChordMode);
  state.setBpm(preset.bpm);
}

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const clockRef = useRef<MasterClock | null>(null);
  const playModeHandlerRef = useRef<PlayModeHandler | null>(null);
  const drumEngineRef = useRef<DrumEngine | null>(null);
  const looperRef = useRef<LooperController | null>(null);
  const sequencerRef = useRef<Sequencer>(new Sequencer());
  const currentDrumPatternRef = useRef<DrumPattern | null>(null);
  const heldAutoDrumSoundsRef = useRef<Set<DrumSound>>(new Set());
  const dbRef = useRef<HiChordDB | null>(null);
  const midiRef = useRef<MIDIOutputController>(new MIDIOutputController());

  const [activeKeys, setActiveKeys] = useState<Set<ScaleDegree>>(new Set());
  const activeKeysRef = useRef<Set<ScaleDegree>>(new Set());
  const [drumPatternPlaying, setDrumPatternPlaying] = useState(false);
  const [sequencerStep, setSequencerStep] = useState<number | null>(null);
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
  const effects = useAppStore((s) => s.effects);
  const volume = useAppStore((s) => s.volume);
  const joystickDirection = useAppStore((s) => s.joystickDirection);
  const directionRef = useRef<JoystickDirection>('center');

  useEffect(() => {
    midiRef.current.init().catch(() => { /* Web MIDI unavailable — no-op */ });
  }, []);

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    const clock = new MasterClock(engine.getContext());
    clockRef.current = clock;
    const arpeggiator = new Arpeggiator();
    playModeHandlerRef.current = new PlayModeHandler(engine, clock, arpeggiator);

    const drums = new DrumEngine(engine.getContext(), engine.getOutputNode());
    drumEngineRef.current = drums;

    const looper = new LooperController(engine.getContext() as AudioContext);
    looperRef.current = looper;
    void looper.init().then(() => {
      looper.connectInput(engine.getOutputNode());
      looper.connectOutput(engine.getContext().destination);
    });

    const db = new HiChordDB();
    dbRef.current = db;
    void db.listPresets().then((existing) => {
      if (existing.length > 0) return;
      return Promise.all(FACTORY_PRESETS.map((preset) => db.savePreset(preset)));
    }).catch(console.error);
  }, []);

  const handleSavePreset = useCallback(async (id: string, name: string) => {
    const db = dbRef.current;
    if (!db) return;
    try {
      const preset = stateToPreset(id, name);
      await db.savePreset(preset);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleLoadPreset = useCallback(async (id: string) => {
    const db = dbRef.current;
    if (!db) return;
    try {
      const preset = await db.loadPreset(id);
      applyPresetToStore(preset);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const triggerChord = useCallback((degree: ScaleDegree) => {
    const engine = engineRef.current;
    const playModeHandler = playModeHandlerRef.current;
    if (!engine || !playModeHandler) return;
    playModeHandler.start();

    const state = useAppStore.getState();
    const chord = getChord(
      state.key, state.scale, degree, 4 + state.globalOctave,
      directionRef.current, state.joystickMode, state.inversions[degree - 1]!,
      state.bassMode, state.chordLocks,
    );
    playModeHandler.handleChordDown(chord);
    state.setCurrentChordName(chord.displayName);
    setActiveKeys((prev) => { const s = new Set(prev).add(degree); activeKeysRef.current = s; return s; });
    midiRef.current.sendChord(chord);
  }, []);

  const releaseChord = useCallback((degree: ScaleDegree) => {
    playModeHandlerRef.current?.handleChordUp();
    setActiveKeys((prev) => { const s = new Set(prev); s.delete(degree); activeKeysRef.current = s; return s; });
    if (useAppStore.getState().playMode !== 'drone') {
      midiRef.current.releaseAll();
    }
  }, []);

  const handleDirection = useCallback((dir: JoystickDirection) => {
    directionRef.current = dir;
    useAppStore.getState().setJoystickDirection(dir);
    // Retrigger held chord with new joystick direction
    const held = activeKeysRef.current;
    if (held.size > 0) {
      const engine = engineRef.current;
      const playModeHandler = playModeHandlerRef.current;
      if (!engine || !playModeHandler) return;
      const state = useAppStore.getState();
      const degree = held.values().next().value as ScaleDegree;
      const chord = getChord(
        state.key, state.scale, degree, 4 + state.globalOctave,
        dir, state.joystickMode, state.inversions[degree - 1]!,
        state.bassMode, state.chordLocks,
      );
      playModeHandler.handleChordDown(chord);
      state.setCurrentChordName(chord.displayName);
      midiRef.current.sendChord(chord);
    }
  }, []);

  const handleCenterTap = useCallback(() => {
    // Looper toggle or randomize — implemented in later tasks
  }, []);

  const handleVolume = useCallback((vol: number) => {
    useAppStore.getState().setVolume(vol);
    engineRef.current?.setMasterVolume(vol);
  }, []);

  const handleVolumeDelta = useCallback((delta: number) => {
    const state = useAppStore.getState();
    const vol = Math.max(0, Math.min(1, state.volume + delta));
    state.setVolume(vol);
    engineRef.current?.setMasterVolume(vol);
  }, []);

  const handleFunctionButton = useCallback((btn: 'gray' | 'yellow' | 'red', down: boolean) => {
    const state = useAppStore.getState();
    state.setHeldFunctionButton(btn, down);
    if (!down) {
      state.setActiveOverlay(state.activeOverlay === btn ? null : btn);
    }
  }, []);

  const handleTrackToggle = useCallback((index: number) => {
    useAppStore.getState().setActiveTrack(index);
  }, []);

  // --- Drum mode wiring -----------------------------------------------------

  const handleTriggerDrum = useCallback((sound: DrumSound) => {
    drumEngineRef.current?.triggerDrum(sound);
  }, []);

  const handleDrumHoldChange = useCallback((sound: DrumSound, held: boolean) => {
    if (held) {
      heldAutoDrumSoundsRef.current.add(sound);
    } else {
      heldAutoDrumSoundsRef.current.delete(sound);
    }
  }, []);

  const handleDrumPatternChange = useCallback((pattern: DrumPattern | null) => {
    currentDrumPatternRef.current = pattern;
  }, []);

  const handleToggleDrumPattern = useCallback(() => {
    setDrumPatternPlaying((p) => !p);
  }, []);

  useEffect(() => {
    drumEngineRef.current?.setKit(drumKit);
  }, [drumKit]);

  // Drives drum-loop pattern playback off the master clock.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    if (playMode !== 'drumLoops' || !drumPatternPlaying) return;

    clock.start();
    const unsubscribe = clock.onTick((_time, step) => {
      const idx = step % 16;
      const pattern = currentDrumPatternRef.current;
      if (!pattern) return;
      for (const hit of pattern.hits) {
        if (hit.step === idx) drumEngineRef.current?.triggerDrum(hit.sound);
      }
    });
    return () => {
      unsubscribe();
      clock.stop();
    };
  }, [playMode, drumPatternPlaying]);

  // Auto-drum: held pads retrigger at the clock rate.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    if (playMode !== 'autoDrum') return;

    clock.start();
    const unsubscribe = clock.onTick(() => {
      for (const sound of heldAutoDrumSoundsRef.current) {
        drumEngineRef.current?.triggerDrum(sound);
      }
    });
    return () => {
      unsubscribe();
      clock.stop();
    };
  }, [playMode]);

  // --- Looper mode wiring -----------------------------------------------------

  const handleLooperRecordToggle = useCallback((trackIndex: number) => {
    const looper = looperRef.current;
    const engine = engineRef.current;
    const state = useAppStore.getState();
    if (!looper || !engine) return;

    if (state.looperState === 'recording') {
      looper.stopRecording(trackIndex);
      state.setLooperState('looping');
      state.setLooperTrack(trackIndex, { state: 'playing' });
    } else {
      const ctx = engine.getContext();
      const loopLength = calculateLoopLength(state.looperBars, state.bpm, ctx.sampleRate);
      looper.startRecording(trackIndex, loopLength);
      state.setLooperState('recording');
      state.setLooperTrack(trackIndex, { state: 'recording' });
    }
  }, []);

  const handleLooperStop = useCallback(() => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    if (!looper) return;
    if (state.looperState === 'recording') {
      looper.stopRecording(state.activeTrack);
      state.setLooperTrack(state.activeTrack, { state: 'playing' });
    } else if (state.looperState === 'looping') {
      looper.togglePlayback();
    }
    state.setLooperState('off');
  }, []);

  const handleLooperPlayToggle = useCallback(() => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    if (!looper) return;
    looper.togglePlayback();
    state.setLooperState(state.looperState === 'looping' ? 'off' : 'looping');
  }, []);

  const handleLooperTrackMute = useCallback((trackIndex: number) => {
    const looper = looperRef.current;
    const state = useAppStore.getState();
    const track = state.looperTracks.find((t) => t.index === trackIndex);
    if (!looper || !track) return;
    if (track.state === 'muted') {
      looper.unmuteTrack(trackIndex);
      state.setLooperTrack(trackIndex, { state: 'playing' });
    } else {
      looper.muteTrack(trackIndex);
      state.setLooperTrack(trackIndex, { state: 'muted' });
    }
  }, []);

  // --- Sequencer mode wiring -----------------------------------------------------

  useEffect(() => {
    const clock = clockRef.current;
    const engine = engineRef.current;
    if (!clock || !engine) return;
    if (playMode !== 'sequencer') {
      setSequencerStep(null);
      return;
    }

    clock.start();
    const unsubscribe = clock.onTick((_time, step) => {
      const idx = step % 16;
      setSequencerStep(idx);
      const seqStep = sequencerRef.current.getStep(idx);
      if (!seqStep) return;
      const state = useAppStore.getState();
      const chord = getChord(
        state.key, state.scale, seqStep.degree, 4 + state.globalOctave,
        seqStep.direction, state.joystickMode, state.inversions[seqStep.degree - 1]!,
        state.bassMode, state.chordLocks,
      );
      engine.triggerChord(chord);
      const releaseMs = clock.getStepDuration() * seqStep.durationSteps * 1000 * 0.9;
      setTimeout(() => engine.releaseChord(), Math.max(10, releaseMs));
    });
    return () => {
      unsubscribe();
      clock.stop();
      setSequencerStep(null);
    };
  }, [playMode]);

  // Sync play-mode routing settings to the PlayModeHandler.
  useEffect(() => {
    playModeHandlerRef.current?.setMode(playMode);
  }, [playMode]);

  useEffect(() => {
    playModeHandlerRef.current?.setStrumSpeed(strumSpeed);
  }, [strumSpeed]);

  useEffect(() => {
    playModeHandlerRef.current?.setArpSettings(arpPattern, arpRate, arpChordMode);
  }, [arpPattern, arpRate, arpChordMode]);

  useEffect(() => {
    clockRef.current?.setBpm(bpm);
  }, [bpm]);

  // Sync synth/engine settings from the store to the AudioEngine.
  useEffect(() => {
    engineRef.current?.setSynthMode(synthMode);
  }, [synthMode]);

  useEffect(() => {
    engineRef.current?.setWaveform(waveform);
  }, [waveform]);

  useEffect(() => {
    engineRef.current?.setAdsr(adsr);
  }, [adsr]);

  useEffect(() => {
    engineRef.current?.setFmPresetIndex(fmPresetIndex);
  }, [fmPresetIndex]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, settings] of Object.entries(effects)) {
      engine.setEffect(type as keyof typeof effects, settings.enabled, settings.value);
    }
  }, [effects]);

  useEffect(() => {
    const keyboardHandler = new KeyboardHandler({
      onChordDown: triggerChord,
      onChordUp: releaseChord,
      onDirection: handleDirection,
      onFunctionButton: handleFunctionButton,
      onCenterTap: handleCenterTap,
      onVolumeChange: handleVolumeDelta,
      onTrackToggle: handleTrackToggle,
    });
    keyboardHandler.attach();
    return () => keyboardHandler.detach();
  }, [triggerChord, releaseChord, handleDirection, handleFunctionButton, handleCenterTap, handleVolumeDelta, handleTrackToggle]);

  const handleGameChordTrigger = useCallback((voicing: ChordVoicing) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resume();
    engine.triggerChord(voicing);
    setTimeout(() => engine.releaseChord(), 800);
  }, []);

  const chordLabels = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

  const centerAreaProps: CenterAreaProps = {
    drumViewProps: {
      onTriggerDrum: handleTriggerDrum,
      onHoldChange: handleDrumHoldChange,
      onPatternChange: handleDrumPatternChange,
      isPlaying: drumPatternPlaying,
      onTogglePlay: handleToggleDrumPattern,
    },
    looperViewProps: {
      onRecordToggle: handleLooperRecordToggle,
      onStop: handleLooperStop,
      onPlayToggle: handleLooperPlayToggle,
      onTrackMuteToggle: handleLooperTrackMute,
    },
    sequencerGridProps: {
      sequencer: sequencerRef.current,
      currentStep: sequencerStep,
    },
    onChordTrigger: handleGameChordTrigger,
  };

  return (
    <Layout
      onKeyDown={triggerChord}
      onKeyUp={releaseChord}
      onDirectionChange={handleDirection}
      onCenterTap={handleCenterTap}
      onVolumeChange={handleVolume}
      activeKeys={activeKeys}
      volume={volume}
      currentModLabel={joystickDirection === 'center' ? '' : joystickDirection}
      chordLabels={chordLabels}
      centerAreaProps={centerAreaProps}
    />
  );
}
