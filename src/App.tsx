import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore } from '@/store';
import { AudioEngine } from '@/audio/engine';
import { MasterClock } from '@/audio/clock';
import { Arpeggiator } from '@/audio/arpeggiator';
import { PlayModeHandler } from '@/audio/play-modes';
import { DrumEngine } from '@/audio/drums';
import { LooperController, calculateLoopLength } from '@/audio/looper';
import { Sequencer } from '@/audio/sequencer';
import { getChord } from '@/music/chord-engine';
import { KeyboardHandler } from '@/input/keyboard-handler';
import type { ScaleDegree, JoystickDirection } from '@/music/types';
import type { DrumSound } from '@/audio/types';
import type { DrumPattern } from '@/data/drum-patterns';
import type { CenterAreaProps } from '@/components/CenterArea';
import '@/styles/global.css';

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const clockRef = useRef<MasterClock | null>(null);
  const playModeHandlerRef = useRef<PlayModeHandler | null>(null);
  const drumEngineRef = useRef<DrumEngine | null>(null);
  const looperRef = useRef<LooperController | null>(null);
  const sequencerRef = useRef<Sequencer>(new Sequencer());
  const currentDrumPatternRef = useRef<DrumPattern | null>(null);
  const heldAutoDrumSoundsRef = useRef<Set<DrumSound>>(new Set());

  const [activeKeys, setActiveKeys] = useState<Set<ScaleDegree>>(new Set());
  const [drumPatternPlaying, setDrumPatternPlaying] = useState(false);
  const [sequencerStep, setSequencerStep] = useState<number | null>(null);
  const store = useAppStore();
  const directionRef = useRef<JoystickDirection>('center');

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
    setActiveKeys((prev) => new Set(prev).add(degree));
  }, []);

  const releaseChord = useCallback((degree: ScaleDegree) => {
    playModeHandlerRef.current?.handleChordUp();
    setActiveKeys((prev) => { const s = new Set(prev); s.delete(degree); return s; });
  }, []);

  const handleDirection = useCallback((dir: JoystickDirection) => {
    directionRef.current = dir;
    useAppStore.getState().setJoystickDirection(dir);
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
    drumEngineRef.current?.setKit(store.drumKit);
  }, [store.drumKit]);

  // Drives drum-loop pattern playback off the master clock.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    if (store.playMode !== 'drumLoops' || !drumPatternPlaying) return;

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
  }, [store.playMode, drumPatternPlaying]);

  // Auto-drum: held pads retrigger at the clock rate.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    if (store.playMode !== 'autoDrum') return;

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
  }, [store.playMode]);

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
    if (state.looperState === 'looping') {
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
    if (store.playMode !== 'sequencer') {
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
  }, [store.playMode]);

  // Sync play-mode routing settings to the PlayModeHandler.
  useEffect(() => {
    playModeHandlerRef.current?.setMode(store.playMode);
  }, [store.playMode]);

  useEffect(() => {
    playModeHandlerRef.current?.setStrumSpeed(store.strumSpeed);
  }, [store.strumSpeed]);

  useEffect(() => {
    playModeHandlerRef.current?.setArpSettings(store.arpPattern, store.arpRate, store.arpChordMode);
  }, [store.arpPattern, store.arpRate, store.arpChordMode]);

  useEffect(() => {
    clockRef.current?.setBpm(store.bpm);
  }, [store.bpm]);

  // Sync synth/engine settings from the store to the AudioEngine.
  useEffect(() => {
    engineRef.current?.setSynthMode(store.synthMode);
  }, [store.synthMode]);

  useEffect(() => {
    engineRef.current?.setWaveform(store.waveform);
  }, [store.waveform]);

  useEffect(() => {
    engineRef.current?.setAdsr(store.adsr);
  }, [store.adsr]);

  useEffect(() => {
    engineRef.current?.setFmPresetIndex(store.fmPresetIndex);
  }, [store.fmPresetIndex]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, settings] of Object.entries(store.effects)) {
      engine.setEffect(type as keyof typeof store.effects, settings.enabled, settings.value);
    }
  }, [store.effects]);

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
  };

  return (
    <Layout
      onKeyDown={triggerChord}
      onKeyUp={releaseChord}
      onDirectionChange={handleDirection}
      onCenterTap={handleCenterTap}
      onVolumeChange={handleVolume}
      activeKeys={activeKeys}
      volume={store.volume}
      currentModLabel={store.joystickDirection === 'center' ? '' : store.joystickDirection}
      chordLabels={chordLabels}
      centerAreaProps={centerAreaProps}
    />
  );
}
