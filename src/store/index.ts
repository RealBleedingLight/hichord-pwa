import { create } from 'zustand';
import type { Key, ScaleName, JoystickMode, JoystickDirection, Inversion, ChordLock, BassMode, ScaleDegree } from '@/music/types';
import type { PlayMode, SynthMode, AnalogWaveform, ADSREnvelope, EffectType, DrumKitName, ArpPattern, ArpRate, ArpChordMode, LooperState, LooperTrack, StrumSpeed } from '@/audio/types';
import { DRUM_PATTERNS, GENRES, getPatternsForGenre, type DrumHit } from '@/data/drum-patterns';

/** One slot in the chord progression: a chord button plus its gesture-pad modifier. */
export interface SequenceSlot {
  degree: ScaleDegree;
  direction: JoystickDirection;
}

/** The progression is 8 half-bar slots = 4 bars of 4/4. */
export const SEQUENCE_SLOTS = 8;
/** Transport 16th-note steps per sequence slot (2 beats). */
export const STEPS_PER_SLOT = 8;

export interface Toast {
  id: number;
  text: string;
}

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
  micSampleAvailable: boolean;
  adsr: ADSREnvelope;

  effects: Record<EffectType, { enabled: boolean; value: number }>;

  bpm: number;
  drumKit: DrumKitName;
  arpPattern: ArpPattern;
  arpRate: ArpRate;
  arpChordMode: ArpChordMode;
  strumSpeed: StrumSpeed;

  /** Transport = the shared 16th-note clock that runs the beat and the chord sequence together. */
  transportPlaying: boolean;
  transportStep: number | null;
  beatEnabled: boolean;
  beatGenre: string;
  beatVariation: number;
  beatHits: DrumHit[];
  beatEdited: boolean;
  sequence: (SequenceSlot | null)[];
  sequenceEnabled: boolean;
  selectedSlot: number | null;

  looperState: LooperState;
  looperTracks: LooperTrack[];
  looperBars: number;
  looperPhase: number;
  activeTrack: number;
  metronomeOn: boolean;

  volume: number;
  currentChordName: string;
  currentChordMidi: number[];

  activeOverlay: 'gray' | 'yellow' | 'red' | 'help' | null;
  heldFunctionButtons: { gray: boolean; yellow: boolean; red: boolean };
  toast: Toast | null;

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
  setMicSampleAvailable: (on: boolean) => void;
  setAdsr: (adsr: ADSREnvelope) => void;
  setEffect: (type: EffectType, update: { enabled?: boolean; value?: number }) => void;
  setBpm: (bpm: number) => void;
  setDrumKit: (kit: DrumKitName) => void;
  setArpPattern: (pattern: ArpPattern) => void;
  setArpRate: (rate: ArpRate) => void;
  setArpChordMode: (mode: ArpChordMode) => void;
  setStrumSpeed: (speed: StrumSpeed) => void;
  setTransportPlaying: (on: boolean) => void;
  setTransportStep: (step: number | null) => void;
  setBeatEnabled: (on: boolean) => void;
  selectBeat: (genre: string, variation: number) => void;
  toggleBeatHit: (step: number, sound: DrumHit['sound']) => void;
  clearBeat: () => void;
  setSequenceSlot: (index: number, slot: SequenceSlot | null) => void;
  clearSequence: () => void;
  setSequenceEnabled: (on: boolean) => void;
  setSelectedSlot: (index: number | null) => void;
  setLooperState: (state: LooperState) => void;
  setLooperTrack: (index: number, update: Partial<LooperTrack>) => void;
  setLooperBars: (bars: number) => void;
  setLooperPhase: (phase: number) => void;
  setActiveTrack: (index: number) => void;
  setMetronome: (on: boolean) => void;
  setVolume: (vol: number) => void;
  setCurrentChordName: (name: string) => void;
  setCurrentChord: (name: string, midi: number[]) => void;
  setActiveOverlay: (overlay: 'gray' | 'yellow' | 'red' | 'help' | null) => void;
  setHeldFunctionButton: (btn: 'gray' | 'yellow' | 'red', held: boolean) => void;
  showToast: (text: string) => void;
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

function beatHitsFor(genre: string, variation: number): DrumHit[] {
  const patterns = getPatternsForGenre(genre);
  const pattern = patterns[variation] ?? patterns[0] ?? DRUM_PATTERNS[0];
  return pattern ? pattern.hits.map((h) => ({ ...h })) : [];
}

// ---------------------------------------------------------------------------
// Session persistence: the musical setup survives reloads. Transient UI state
// (overlays, held buttons, looper audio) is deliberately not saved.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hichord-session-v1';

const PERSISTED_KEYS = [
  'key', 'scale', 'globalOctave', 'buttonOctaves', 'joystickMode', 'bassMode', 'voiceLeading',
  'inversions', 'chordLocks', 'playMode', 'synthMode', 'waveform', 'fmPresetIndex', 'sampleName',
  'adsr', 'effects', 'bpm', 'drumKit', 'arpPattern', 'arpRate', 'arpChordMode', 'strumSpeed',
  'beatEnabled', 'beatGenre', 'beatVariation', 'beatHits', 'beatEdited', 'sequence', 'sequenceEnabled',
  'looperBars', 'metronomeOn', 'volume',
] as const satisfies readonly (keyof AppState)[];

/** Modes that make no sense to reopen straight into (they need a mic or start a game). */
const NON_RESTORABLE_MODES = new Set<PlayMode>(['tuner', 'micSample', 'chordHiro', 'earTrainer']);

function loadSession(): Partial<AppState> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of PERSISTED_KEYS) {
      if (k in parsed) out[k] = parsed[k];
    }
    if (out.sampleName === 'mic') out.sampleName = 'keys';
    if (typeof out.playMode === 'string' && NON_RESTORABLE_MODES.has(out.playMode as PlayMode)) out.playMode = 'play';
    if (out.effects && typeof out.effects === 'object') {
      out.effects = { ...defaultEffects, ...(out.effects as object) };
    }
    if (Array.isArray(out.sequence) && out.sequence.length !== SEQUENCE_SLOTS) delete out.sequence;
    return out as Partial<AppState>;
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(state: AppState): void {
  if (typeof localStorage === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const out: Record<string, unknown> = {};
      for (const k of PERSISTED_KEYS) out[k] = state[k];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch { /* storage full / blocked — not fatal */ }
  }, 300);
}

let toastId = 0;

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
  sampleName: 'keys',
  micSampleAvailable: false,
  adsr: { attack: 20, decay: 100, sustain: 0.7, release: 300 },

  effects: defaultEffects,

  bpm: 120,
  drumKit: 'tight',
  arpPattern: 'up',
  arpRate: '1/8',
  arpChordMode: 'arpOnly',
  strumSpeed: 'medium',

  transportPlaying: false,
  transportStep: null,
  beatEnabled: true,
  beatGenre: GENRES[0] ?? 'Rock',
  beatVariation: 0,
  beatHits: beatHitsFor(GENRES[0] ?? 'Rock', 0),
  beatEdited: false,
  sequence: Array.from({ length: SEQUENCE_SLOTS }, () => null),
  sequenceEnabled: true,
  selectedSlot: null,

  looperState: 'off',
  looperTracks: Array.from({ length: 6 }, (_, i) => ({ index: i, state: 'empty' as const, gain: 1.0 })),
  looperBars: 4,
  looperPhase: 0,
  activeTrack: 0,
  metronomeOn: true,

  volume: 0.8,
  currentChordName: '',
  currentChordMidi: [],

  activeOverlay: null,
  heldFunctionButtons: { gray: false, yellow: false, red: false },
  toast: null,

  ...loadSession(),

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
    return { chordLocks: [...s.chordLocks, { degree: degree as ScaleDegree, direction }] };
  }),
  setPlayMode: (playMode) => set({ playMode }),
  setSynthMode: (synthMode) => set({ synthMode }),
  setWaveform: (waveform) => set({ waveform }),
  setFmPresetIndex: (fmPresetIndex) => set({ fmPresetIndex }),
  setSampleName: (sampleName) => set({ sampleName }),
  setMicSampleAvailable: (micSampleAvailable) => set({ micSampleAvailable }),
  setAdsr: (adsr) => set({ adsr }),
  setEffect: (type, update) => set((s) => ({
    effects: { ...s.effects, [type]: { ...s.effects[type], ...update } },
  })),
  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(300, Math.round(bpm))) }),
  setDrumKit: (drumKit) => set({ drumKit }),
  setArpPattern: (arpPattern) => set({ arpPattern }),
  setArpRate: (arpRate) => set({ arpRate }),
  setArpChordMode: (arpChordMode) => set({ arpChordMode }),
  setStrumSpeed: (strumSpeed) => set({ strumSpeed }),
  setTransportPlaying: (transportPlaying) => set({ transportPlaying }),
  setTransportStep: (transportStep) => set({ transportStep }),
  setBeatEnabled: (beatEnabled) => set({ beatEnabled }),
  selectBeat: (beatGenre, beatVariation) => set({
    beatGenre, beatVariation, beatHits: beatHitsFor(beatGenre, beatVariation), beatEdited: false,
  }),
  toggleBeatHit: (step, sound) => set((s) => {
    const exists = s.beatHits.some((h) => h.step === step && h.sound === sound);
    const beatHits = exists
      ? s.beatHits.filter((h) => !(h.step === step && h.sound === sound))
      : [...s.beatHits, { step, sound, velocity: 1 }];
    return { beatHits, beatEdited: true };
  }),
  clearBeat: () => set({ beatHits: [], beatEdited: true }),
  setSequenceSlot: (index, slot) => set((s) => {
    const sequence = [...s.sequence];
    sequence[index] = slot;
    return { sequence };
  }),
  clearSequence: () => set({ sequence: Array.from({ length: SEQUENCE_SLOTS }, () => null), selectedSlot: 0 }),
  setSequenceEnabled: (sequenceEnabled) => set({ sequenceEnabled }),
  setSelectedSlot: (selectedSlot) => set({ selectedSlot }),
  setLooperState: (looperState) => set({ looperState }),
  setLooperTrack: (index, update) => set((s) => ({
    looperTracks: s.looperTracks.map((t) => t.index === index ? { ...t, ...update } : t),
  })),
  setLooperBars: (looperBars) => set({ looperBars: Math.max(1, Math.min(8, looperBars)) }),
  setLooperPhase: (looperPhase) => set({ looperPhase }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
  setMetronome: (metronomeOn) => set({ metronomeOn }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setCurrentChordName: (currentChordName) => set({ currentChordName }),
  setCurrentChord: (currentChordName, currentChordMidi) => set({ currentChordName, currentChordMidi }),
  setActiveOverlay: (activeOverlay) => set({ activeOverlay }),
  setHeldFunctionButton: (btn, held) => set((s) => ({
    heldFunctionButtons: { ...s.heldFunctionButtons, [btn]: held },
  })),
  showToast: (text) => set({ toast: { id: ++toastId, text } }),
}));

useAppStore.subscribe((state) => scheduleSave(state));
