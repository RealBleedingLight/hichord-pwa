import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore } from '@/store';
import { AudioEngine } from '@/audio/engine';
import { getChord } from '@/music/chord-engine';
import { KeyboardHandler } from '@/input/keyboard-handler';
import type { ScaleDegree, JoystickDirection } from '@/music/types';
import '@/styles/global.css';

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [activeKeys, setActiveKeys] = useState<Set<ScaleDegree>>(new Set());
  const store = useAppStore();
  const directionRef = useRef<JoystickDirection>('center');

  useEffect(() => {
    engineRef.current = new AudioEngine();
  }, []);

  const triggerChord = useCallback((degree: ScaleDegree) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resume();

    const state = useAppStore.getState();
    const chord = getChord(
      state.key, state.scale, degree, 4 + state.globalOctave,
      directionRef.current, state.joystickMode, state.inversions[degree - 1]!,
      state.bassMode, state.chordLocks,
    );
    engine.triggerChord(chord);
    state.setCurrentChordName(chord.displayName);
    setActiveKeys((prev) => new Set(prev).add(degree));
  }, []);

  const releaseChord = useCallback((degree: ScaleDegree) => {
    engineRef.current?.releaseChord();
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
    />
  );
}
