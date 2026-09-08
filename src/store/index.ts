import { create } from 'zustand';
import type { Key, ScaleName, JoystickMode, JoystickDirection, Inversion, ChordLock, BassMode } from '@/music/types';
import type { PlayMode, SynthMode, AnalogWaveform, ADSREnvelope, EffectType, DrumKitName, ArpPattern, ArpRate, ArpChordMode, LooperState, LooperTrack, StrumSpeed } from '@/audio/types';

export interface AppState {
  key: Key;
  scale: ScaleName;
  globalOctave: number;
  buttonOctaves: number[];
  joystickMode: JoystickMode;
  joystickDirection: JoystickDirection;
  bassMode: BassMode;
  voiceLeading: boolean;
  inversions: Inversion[];
  chordLocks: ChordLock[];

  playMode: PlayMode;
  synthMode: SynthMode;
  waveform: AnalogWaveform;
  fmPresetIndex: number;
  sampleName: string;
  adsr: ADSREnvelope;

  effects: Record<EffectType, { enabled: boolean; value: number }>;

  bpm: number;
  drumKit: DrumKitName;
  arpPattern: ArpPattern;
  arpRate: ArpRate;
  arpChordMode: ArpChordMode;
  strumSpeed: StrumSpeed;

  looperState: LooperState;
  looperTracks: LooperTrack[];
  looperBars: number;
  activeTrack: number;
  metronomeOn: boolean;

  volume: number;
  currentChordName: string;

  activeOverlay: 'gray' | 'yellow' | 'red' | null;
  heldFunctionButtons: { gray: boolean; yellow: boolean; red: boolean };

  setKey: (key: Key) => void;
  setScale: (scale: ScaleName) => void;
  setGlobalOctave: (octave: number) => void;
  setButtonOctave: (button: number, octave: number) => void;
  setJoystickMode: (mode: JoystickMode) => void;
  setJoystickDirection: (dir: JoystickDirection) => void;
  setBassMode: (mode: BassMode) => void;
  setVoiceLeading: (on: boolean) => void;
  setInversion: (degree: number, inv: Inversion) => void;
  toggleChordLock: (degree: number, direction: JoystickDirection) => void;
  setPlayMode: (mode: PlayMode) => void;
  setSynthMode: (mode: SynthMode) => void;
  setWaveform: (wf: AnalogWaveform) => void;
  setFmPresetIndex: (idx: number) => void;
  setSampleName: (name: string) => void;
  setAdsr: (adsr: ADSREnvelope) => void;
  setEffect: (type: EffectType, update: { enabled?: boolean; value?: number }) => void;
  setBpm: (bpm: number) => void;
  setDrumKit: (kit: DrumKitName) => void;
  setArpPattern: (pattern: ArpPattern) => void;
  setArpRate: (rate: ArpRate) => void;
  setArpChordMode: (mode: ArpChordMode) => void;
  setStrumSpeed: (speed: StrumSpeed) => void;
  setLooperState: (state: LooperState) => void;
  setLooperTrack: (index: number, update: Partial<LooperTrack>) => void;
  setLooperBars: (bars: number) => void;
  setActiveTrack: (index: number) => void;
  setMetronome: (on: boolean) => void;
  setVolume: (vol: number) => void;
  setCurrentChordName: (name: string) => void;
  setActiveOverlay: (overlay: 'gray' | 'yellow' | 'red' | null) => void;
  setHeldFunctionButton: (btn: 'gray' | 'yellow' | 'red', held: boolean) => void;
}

const defaultEffects: Record<EffectType, { enabled: boolean; value: number }> = {
  filter: { enabled: false, value: 20000 },
  reverb: { enabled: false, value: 0.3 },
  delay: { enabled: false, value: 0.25 },
  chorus: { enabled: false, value: 0.5 },
  flanger: { enabled: false, value: 0.5 },
  tremolo: { enabled: false, value: 0.5 },
  lfoVibrato: { enabled: false, value: 0.5 },
  glide: { enabled: false, value: 0.5 },
  stereo: { enabled: true, value: 0.7 },
  voiceCount: { enabled: true, value: 1.0 },
};

export const useAppStore = create<AppState>((set) => ({
  key: 'C',
  scale: 'major',
  globalOctave: 0,
  buttonOctaves: [0, 0, 0, 0, 0, 0, 0],
  joystickMode: 'default',
  joystickDirection: 'center',
  bassMode: 'off',
  voiceLeading: false,
  inversions: [0, 0, 0, 0, 0, 0, 0] as Inversion[],
  chordLocks: [],

  playMode: 'play',
  synthMode: 'analog',
  waveform: 'sawtooth',
  fmPresetIndex: 0,
  sampleName: 'piano',
  adsr: { attack: 20, decay: 100, sustain: 0.7, release: 300 },

  effects: defaultEffects,

  bpm: 120,
  drumKit: 'tight',
  arpPattern: 'up',
  arpRate: '1/8',
  arpChordMode: 'arpOnly',
  strumSpeed: 'medium',

  looperState: 'off',
  looperTracks: Array.from({ length: 6 }, (_, i) => ({ index: i, state: 'empty' as const, gain: 1.0 })),
  looperBars: 4,
  activeTrack: 0,
  metronomeOn: true,

  volume: 0.8,
  currentChordName: '',

  activeOverlay: null,
  heldFunctionButtons: { gray: false, yellow: false, red: false },

  setKey: (key) => set({ key }),
  setScale: (scale) => set({ scale }),
  setGlobalOctave: (globalOctave) => set({ globalOctave: Math.max(-1, Math.min(2, globalOctave)) }),
  setButtonOctave: (button, octave) => set((s) => {
    const buttonOctaves = [...s.buttonOctaves];
    buttonOctaves[button] = Math.max(-2, Math.min(1, octave));
    return { buttonOctaves };
  }),
  setJoystickMode: (joystickMode) => set({ joystickMode }),
  setJoystickDirection: (joystickDirection) => set({ joystickDirection }),
  setBassMode: (bassMode) => set({ bassMode }),
  setVoiceLeading: (voiceLeading) => set({ voiceLeading }),
  setInversion: (degree, inv) => set((s) => {
    const inversions = [...s.inversions] as Inversion[];
    inversions[degree] = inv;
    return { inversions };
  }),
  toggleChordLock: (degree, direction) => set((s) => {
    const existing = s.chordLocks.findIndex((l) => l.degree === degree);
    if (existing >= 0) {
      return { chordLocks: s.chordLocks.filter((_, i) => i !== existing) };
    }
    return { chordLocks: [...s.chordLocks, { degree: degree as any, direction }] };
  }),
  setPlayMode: (playMode) => set({ playMode }),
  setSynthMode: (synthMode) => set({ synthMode }),
  setWaveform: (waveform) => set({ waveform }),
  setFmPresetIndex: (fmPresetIndex) => set({ fmPresetIndex }),
  setSampleName: (sampleName) => set({ sampleName }),
  setAdsr: (adsr) => set({ adsr }),
  setEffect: (type, update) => set((s) => ({
    effects: { ...s.effects, [type]: { ...s.effects[type], ...update } },
  })),
  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(300, bpm)) }),
  setDrumKit: (drumKit) => set({ drumKit }),
  setArpPattern: (arpPattern) => set({ arpPattern }),
  setArpRate: (arpRate) => set({ arpRate }),
  setArpChordMode: (arpChordMode) => set({ arpChordMode }),
  setStrumSpeed: (strumSpeed) => set({ strumSpeed }),
  setLooperState: (looperState) => set({ looperState }),
  setLooperTrack: (index, update) => set((s) => ({
    looperTracks: s.looperTracks.map((t) => t.index === index ? { ...t, ...update } : t),
  })),
  setLooperBars: (looperBars) => set({ looperBars: Math.max(0, Math.min(8, looperBars)) }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
  setMetronome: (metronomeOn) => set({ metronomeOn }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setCurrentChordName: (currentChordName) => set({ currentChordName }),
  setActiveOverlay: (activeOverlay) => set({ activeOverlay }),
  setHeldFunctionButton: (btn, held) => set((s) => ({
    heldFunctionButtons: { ...s.heldFunctionButtons, [btn]: held },
  })),
}));
