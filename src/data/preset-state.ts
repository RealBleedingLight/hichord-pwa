import { useAppStore } from '@/store';
import type { Preset } from '@/audio/types';

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
    sampleName: state.sampleName === 'mic' ? 'keys' : state.sampleName,
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
    // Presets saved before voice count was implemented stored an unused 1.0.
    const fixed = type === 'voiceCount' && settings.value < 1.5 ? { enabled: false, value: 6 } : settings;
    state.setEffect(type as keyof typeof preset.effects, fixed);
  }
  state.setKey(preset.key);
  state.setScale(preset.scale);
  state.setGlobalOctave(preset.globalOctave);
  preset.buttonOctaves.forEach((octave, i) => state.setButtonOctave(i, octave));
  preset.inversions.forEach((inv, degree) => state.setInversion(degree, inv));
  useAppStore.setState({ chordLocks: preset.chordLocks });
  state.setBassMode(preset.bassMode);
  state.setVoiceLeading(preset.voiceLeading);
  state.setJoystickMode(preset.joystickMode);
  state.setDrumKit(preset.drumKit);
  state.setArpPattern(preset.arpPattern);
  state.setArpRate(preset.arpRate);
  state.setArpChordMode(preset.arpChordMode);
  state.setBpm(preset.bpm);
}
