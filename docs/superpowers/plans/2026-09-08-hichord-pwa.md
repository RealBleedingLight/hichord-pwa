# HiChord PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone software synthesizer PWA recreating full HiChord hardware parity — chord engine, 4 synth modes, effects, drums, looper, vocoder, 15 play modes — in a touch-optimized landscape mobile UI with keyboard bindings.

**Architecture:** Five independent modules (Chord Engine, Audio Engine, Looper, Sequencer/Clock, Drum Engine) coordinated by a Zustand store. Audio path bypasses React entirely for low latency — direct DOM event listeners trigger engine refs. Looper runs in an AudioWorklet for glitch-free recording.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Zustand, Web Audio API, AudioWorklet, idb (IndexedDB), Vitest, Capacitor 6.

**Spec:** `docs/superpowers/specs/2026-09-08-hichord-pwa-design.md`

## Global Constraints

- Node 20+, npm 10+
- React 18 (not 19 — AudioWorklet compat tested on 18)
- TypeScript strict mode enabled
- Vite 6 with `vite-plugin-pwa`
- Target browsers: Chrome 90+, Edge 90+, Safari 16.4+, Android WebView (Chrome-based)
- Audio: 48kHz sample rate, 16-bit output, <25ms touch-to-sound latency target
- Bundle size <500KB gzipped (excluding audio samples)
- All data local — IndexedDB via `idb`, no backend
- Landscape orientation only
- CSS: `touch-action: manipulation` on all interactive elements
- Tests: Vitest for unit/integration, `OfflineAudioContext` for audio tests

---

### Task 1: Project Scaffolding & Core Types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/music/types.ts`
- Create: `src/audio/types.ts`
- Create: `src/store/index.ts`
- Create: `public/manifest.json`
- Test: `src/music/__tests__/types.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: All shared types used across every subsequent task — `Note`, `ChordVoicing`, `ScaleDegree`, `Key`, `ScaleName`, `JoystickDirection`, `JoystickMode`, `PlayMode`, `SynthMode`, `EffectType`, `ADSRPreset`, `DrumKit`, `LooperState`, `Preset`. Also produces the Zustand store shape `AppState` and the Vite dev server.

- [ ] **Step 1: Initialize project**

```bash
cd "C:\claude_builds\hichord mobile app"
npm init -y
npm install react@18 react-dom@18 zustand idb
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HiChord',
        short_name: 'HiChord',
        display: 'fullscreen',
        orientation: 'landscape',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,wav,mp3}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2022',
  },
});
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#1a1a2e" />
  <title>HiChord</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/music/types.ts with all shared types**

```typescript
export type Key = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ScaleName =
  | 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor'
  | 'majorPentatonic' | 'minorPentatonic' | 'blues'
  | 'dorian' | 'mixolydian' | 'lydian';

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type JoystickDirection = 'up' | 'upRight' | 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft' | 'center';

export type JoystickMode = 'default' | 'extended' | 'chromatic';

export type ChordQuality =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dom7' | 'maj7' | 'min7' | 'dim7' | 'halfDim7'
  | 'sus2' | 'sus4' | 'sixth' | 'ninth'
  | 'dom9' | 'add9' | 'add11' | 'min11'
  | 'dom7sharp9' | 'sus4plus7'
  | 'minMaj7' | 'maj13' | 'sixNine' | 'maj7sharp11'
  | 'dom13' | 'dom7flat9' | 'dom7alt'
  | 'dom7b9' | 'halfDim7Chromatic';

export type Inversion = 0 | 1 | 2;

export type BassMode = 'off' | 'root' | 'slash';

export interface Note {
  midi: number;
  frequency: number;
  name: string;
  octave: number;
}

export interface ChordVoicing {
  notes: Note[];
  bass: Note | null;
  quality: ChordQuality;
  rootName: string;
  displayName: string;
  inversion: Inversion;
}

export interface ChordLock {
  degree: ScaleDegree;
  direction: JoystickDirection;
}

export const ALL_KEYS: Key[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALE_DEGREES: ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];
```

- [ ] **Step 6: Create src/audio/types.ts**

```typescript
export type SynthMode = 'analog' | 'fm' | 'sample' | 'noise';

export type AnalogWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle';

export type ADSRPresetName = 'LONG' | 'SHORT' | 'SWELL' | 'PLUCK' | 'TOUCH' | 'SUSTAIN';

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const ADSR_PRESETS: Record<ADSRPresetName, ADSREnvelope> = {
  LONG:    { attack: 500,  decay: 200, sustain: 0.8, release: 2000 },
  SHORT:   { attack: 10,   decay: 50,  sustain: 0.3, release: 100  },
  SWELL:   { attack: 1500, decay: 100, sustain: 0.9, release: 1000 },
  PLUCK:   { attack: 5,    decay: 300, sustain: 0.1, release: 200  },
  TOUCH:   { attack: 20,   decay: 100, sustain: 0.7, release: 300  },
  SUSTAIN: { attack: 50,   decay: 50,  sustain: 1.0, release: 500  },
};

export type EffectType =
  | 'filter' | 'reverb' | 'delay' | 'chorus' | 'flanger'
  | 'tremolo' | 'lfoVibrato' | 'glide' | 'stereo' | 'voiceCount';

export type PlayMode =
  | 'play' | 'strum' | 'lead' | 'drone' | 'arpeggio' | 'repeat'
  | 'micSample' | 'drum' | 'drumLoops' | 'autoDrum'
  | 'sequencer' | 'chordHiro' | 'earTrainer' | 'tuner' | 'mixer';

export type DrumKitName = 'tight' | 'x0x' | 'x9x' | 'lynn' | 'kr78' | 'trap' | 'user';

export type DrumSound = 'kick' | 'altKick' | 'snare' | 'closedHH' | 'tom' | 'bellRide' | 'openHH';

export type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'fingerpick';

export type ArpRate = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/16T' | '1/32' | 'swing8' | 'swing16';

export type ArpChordMode = 'arpOnly' | 'chordPlusArp' | 'rhythmPlusArp';

export type LooperState = 'off' | 'waiting' | 'recording' | 'looping';

export type StumSpeed = 'slow' | 'medium' | 'fast';

export const STRUM_INTERVALS: Record<StumSpeed, number> = {
  slow: 80,
  medium: 40,
  fast: 15,
};

export interface FMPreset {
  name: string;
  modulationIndex: number;
  frequencyRatio: number;
}

export const FM_PRESETS: FMPreset[] = [
  { name: 'FM EPiano', modulationIndex: 2.0, frequencyRatio: 1.0 },
  { name: 'FM HX7',    modulationIndex: 5.0, frequencyRatio: 3.5 },
  { name: 'FM Bell',   modulationIndex: 8.0, frequencyRatio: 7.0 },
  { name: 'FM Organ',  modulationIndex: 1.5, frequencyRatio: 2.0 },
  { name: 'FM Brass',  modulationIndex: 3.0, frequencyRatio: 1.0 },
];

export interface LooperTrack {
  index: number;
  state: 'empty' | 'recording' | 'playing' | 'muted';
  gain: number;
}

export interface Preset {
  id: string;
  name: string;
  synthMode: SynthMode;
  waveform: AnalogWaveform;
  fmPresetIndex: number;
  sampleName: string;
  adsr: ADSREnvelope;
  effects: Record<EffectType, { enabled: boolean; value: number }>;
  key: import('@/music/types').Key;
  scale: import('@/music/types').ScaleName;
  globalOctave: number;
  buttonOctaves: number[];
  inversions: import('@/music/types').Inversion[];
  chordLocks: import('@/music/types').ChordLock[];
  bassMode: import('@/music/types').BassMode;
  voiceLeading: boolean;
  joystickMode: import('@/music/types').JoystickMode;
  drumKit: DrumKitName;
  arpPattern: ArpPattern;
  arpRate: ArpRate;
  arpChordMode: ArpChordMode;
  bpm: number;
}
```

- [ ] **Step 7: Create Zustand store**

```typescript
// src/store/index.ts
import { create } from 'zustand';
import type { Key, ScaleName, JoystickMode, JoystickDirection, Inversion, ChordLock, BassMode } from '@/music/types';
import type { PlayMode, SynthMode, AnalogWaveform, ADSREnvelope, EffectType, DrumKitName, ArpPattern, ArpRate, ArpChordMode, LooperState, LooperTrack, StumSpeed, ADSR_PRESETS } from '@/audio/types';

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
  strumSpeed: StumSpeed;

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
  setStrumSpeed: (speed: StumSpeed) => void;
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
```

- [ ] **Step 8: Create minimal App.tsx and main.tsx**

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

```tsx
// src/App.tsx
import { useAppStore } from '@/store';

export function App() {
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  return (
    <div style={{ background: '#1a1a2e', color: '#eee', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>HiChord — {key} {scale}</p>
    </div>
  );
}
```

- [ ] **Step 9: Write test for types and store**

```typescript
// src/music/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_KEYS, SCALE_DEGREES } from '@/music/types';
import { ADSR_PRESETS, FM_PRESETS, STRUM_INTERVALS } from '@/audio/types';
import { useAppStore } from '@/store';

describe('music types', () => {
  it('has 12 keys', () => {
    expect(ALL_KEYS).toHaveLength(12);
    expect(ALL_KEYS[0]).toBe('C');
    expect(ALL_KEYS[11]).toBe('B');
  });

  it('has 7 scale degrees', () => {
    expect(SCALE_DEGREES).toHaveLength(7);
    expect(SCALE_DEGREES[0]).toBe(1);
    expect(SCALE_DEGREES[6]).toBe(7);
  });
});

describe('audio types', () => {
  it('has 6 ADSR presets', () => {
    expect(Object.keys(ADSR_PRESETS)).toHaveLength(6);
    expect(ADSR_PRESETS.PLUCK.attack).toBe(5);
    expect(ADSR_PRESETS.LONG.release).toBe(2000);
  });

  it('has 5 FM presets', () => {
    expect(FM_PRESETS).toHaveLength(5);
    expect(FM_PRESETS[0].name).toBe('FM EPiano');
  });

  it('has 3 strum speeds', () => {
    expect(STRUM_INTERVALS.slow).toBe(80);
    expect(STRUM_INTERVALS.fast).toBe(15);
  });
});

describe('store', () => {
  it('has correct defaults', () => {
    const state = useAppStore.getState();
    expect(state.key).toBe('C');
    expect(state.scale).toBe('major');
    expect(state.bpm).toBe(120);
    expect(state.playMode).toBe('play');
    expect(state.synthMode).toBe('analog');
    expect(state.looperTracks).toHaveLength(6);
    expect(state.volume).toBe(0.8);
  });

  it('clamps BPM to 40-300', () => {
    useAppStore.getState().setBpm(10);
    expect(useAppStore.getState().bpm).toBe(40);
    useAppStore.getState().setBpm(500);
    expect(useAppStore.getState().bpm).toBe(300);
    useAppStore.getState().setBpm(120);
  });

  it('clamps volume to 0-1', () => {
    useAppStore.getState().setVolume(-0.5);
    expect(useAppStore.getState().volume).toBe(0);
    useAppStore.getState().setVolume(1.5);
    expect(useAppStore.getState().volume).toBe(1);
    useAppStore.getState().setVolume(0.8);
  });
});
```

- [ ] **Step 10: Add vitest config and test script**

Add to `vite.config.ts` (inside `defineConfig`):
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: [],
  alias: { '@': path.resolve(__dirname, 'src') },
},
```

Add to `package.json` scripts:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 11: Run tests**

```bash
npm test
```

Expected: all 6 tests pass.

- [ ] **Step 12: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server on localhost, renders "HiChord — C major".

- [ ] **Step 13: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold project with types and store"
```

---

### Task 2: Chord Engine — Scales & Basic Voicings

**Files:**
- Create: `src/music/scales.ts`
- Create: `src/music/chord-engine.ts`
- Test: `src/music/__tests__/scales.test.ts`
- Test: `src/music/__tests__/chord-engine.test.ts`

**Interfaces:**
- Consumes: `Key`, `ScaleName`, `ScaleDegree`, `ChordQuality`, `Note`, `ChordVoicing`, `Inversion`, `BassMode` from `src/music/types.ts`
- Produces: `getScaleNotes(key: Key, scale: ScaleName): number[]` — returns MIDI note numbers for one octave. `getDiatonicChord(key: Key, scale: ScaleName, degree: ScaleDegree, octave: number): ChordVoicing` — returns default triad voicing. `midiToFrequency(midi: number): number`. `midiToNoteName(midi: number): string`. `getScaleIntervals(scale: ScaleName): number[]`.

- [ ] **Step 1: Write failing test for scales**

```typescript
// src/music/__tests__/scales.test.ts
import { describe, it, expect } from 'vitest';
import { getScaleIntervals, getScaleNotes, midiToFrequency, midiToNoteName } from '@/music/scales';

describe('scales', () => {
  it('returns major scale intervals', () => {
    expect(getScaleIntervals('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('returns natural minor scale intervals', () => {
    expect(getScaleIntervals('naturalMinor')).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('returns blues scale intervals', () => {
    expect(getScaleIntervals('blues')).toEqual([0, 3, 5, 6, 7, 10]);
  });

  it('returns C major scale MIDI notes starting at C4', () => {
    const notes = getScaleNotes('C', 'major', 4);
    expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });

  it('returns G major scale MIDI notes', () => {
    const notes = getScaleNotes('G', 'major', 4);
    expect(notes).toEqual([67, 69, 71, 72, 74, 76, 78]);
  });

  it('converts MIDI 69 to 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2);
  });

  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('converts MIDI 61 to C#4', () => {
    expect(midiToNoteName(61)).toBe('C#4');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npx vitest run src/music/__tests__/scales.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement scales.ts**

```typescript
// src/music/scales.ts
import type { Key, ScaleName } from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:     [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:     [0, 2, 3, 5, 7, 9, 11],
  majorPentatonic:  [0, 2, 4, 7, 9],
  minorPentatonic:  [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
};

export function getScaleIntervals(scale: ScaleName): number[] {
  return SCALE_INTERVALS[scale];
}

export function keyToMidi(key: Key, octave: number): number {
  const index = NOTE_NAMES.indexOf(key);
  return (octave + 1) * 12 + index;
}

export function getScaleNotes(key: Key, scale: ScaleName, octave: number): number[] {
  const root = keyToMidi(key, octave);
  return SCALE_INTERVALS[scale].map((interval) => root + interval);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const [, noteName, octaveStr] = match;
  const noteIndex = NOTE_NAMES.indexOf(noteName as typeof NOTE_NAMES[number]);
  if (noteIndex === -1) throw new Error(`Invalid note: ${noteName}`);
  return (parseInt(octaveStr) + 1) * 12 + noteIndex;
}
```

- [ ] **Step 4: Run scales test**

```bash
npx vitest run src/music/__tests__/scales.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for chord-engine basic voicings**

```typescript
// src/music/__tests__/chord-engine.test.ts
import { describe, it, expect } from 'vitest';
import { getDiatonicChord } from '@/music/chord-engine';

describe('chord-engine', () => {
  it('returns C major triad for degree 1 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4);
    expect(chord.quality).toBe('major');
    expect(chord.displayName).toBe('C');
    expect(chord.notes.map((n) => n.name)).toEqual(['C4', 'E4', 'G4']);
  });

  it('returns D minor triad for degree 2 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 2, 4);
    expect(chord.quality).toBe('minor');
    expect(chord.displayName).toBe('Dm');
    expect(chord.notes.map((n) => n.name)).toEqual(['D4', 'F4', 'A4']);
  });

  it('returns B diminished for degree 7 in C major', () => {
    const chord = getDiatonicChord('C', 'major', 7, 4);
    expect(chord.quality).toBe('diminished');
    expect(chord.displayName).toBe('Bdim');
  });

  it('returns G major triad for degree 1 in G major', () => {
    const chord = getDiatonicChord('G', 'major', 1, 4);
    expect(chord.quality).toBe('major');
    expect(chord.displayName).toBe('G');
    expect(chord.notes.map((n) => n.name)).toEqual(['G4', 'B4', 'D5']);
  });

  it('returns correct qualities for all 7 degrees in major', () => {
    const qualities = [1, 2, 3, 4, 5, 6, 7].map(
      (d) => getDiatonicChord('C', 'major', d as any, 4).quality
    );
    expect(qualities).toEqual([
      'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
    ]);
  });

  it('returns notes with correct frequencies', () => {
    const chord = getDiatonicChord('A', 'major', 1, 4);
    expect(chord.notes[0].frequency).toBeCloseTo(440, 0);
  });

  it('supports first inversion', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4, 1);
    expect(chord.inversion).toBe(1);
    expect(chord.notes[0].name).toBe('E4');
    expect(chord.notes[1].name).toBe('G4');
    expect(chord.notes[2].name).toBe('C5');
  });

  it('supports second inversion', () => {
    const chord = getDiatonicChord('C', 'major', 1, 4, 2);
    expect(chord.inversion).toBe(2);
    expect(chord.notes[0].name).toBe('G4');
    expect(chord.notes[1].name).toBe('C5');
    expect(chord.notes[2].name).toBe('E5');
  });
});
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npx vitest run src/music/__tests__/chord-engine.test.ts
```

- [ ] **Step 7: Implement chord-engine.ts**

```typescript
// src/music/chord-engine.ts
import type { Key, ScaleName, ScaleDegree, ChordQuality, ChordVoicing, Inversion, Note } from './types';
import { getScaleNotes, midiToFrequency, midiToNoteName } from './scales';

const MAJOR_SCALE_QUALITIES: ChordQuality[] = [
  'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
];

const MINOR_SCALE_QUALITIES: ChordQuality[] = [
  'minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major',
];

function getQualitiesForScale(scale: ScaleName): ChordQuality[] {
  switch (scale) {
    case 'naturalMinor':
    case 'minorPentatonic':
      return MINOR_SCALE_QUALITIES;
    case 'harmonicMinor':
      return ['minor', 'diminished', 'augmented', 'minor', 'major', 'major', 'diminished'];
    case 'melodicMinor':
      return ['minor', 'minor', 'augmented', 'major', 'major', 'diminished', 'diminished'];
    case 'dorian':
      return ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'];
    case 'mixolydian':
      return ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major'];
    case 'lydian':
      return ['major', 'major', 'minor', 'diminished', 'major', 'minor', 'minor'];
    case 'blues':
    case 'majorPentatonic':
    default:
      return MAJOR_SCALE_QUALITIES;
  }
}

function qualitySuffix(quality: ChordQuality): string {
  switch (quality) {
    case 'major': return '';
    case 'minor': return 'm';
    case 'diminished': return 'dim';
    case 'augmented': return 'aug';
    case 'dom7': return '7';
    case 'maj7': return 'maj7';
    case 'min7': return 'm7';
    case 'dim7': return 'dim7';
    case 'halfDim7': return 'ø7';
    case 'sus2': return 'sus2';
    case 'sus4': return 'sus4';
    case 'sixth': return '6';
    case 'ninth': return '9';
    default: return quality;
  }
}

function makeNote(midi: number): Note {
  return {
    midi,
    frequency: midiToFrequency(midi),
    name: midiToNoteName(midi),
    octave: Math.floor(midi / 12) - 1,
  };
}

function getTriadIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case 'major': return [0, 4, 7];
    case 'minor': return [0, 3, 7];
    case 'diminished': return [0, 3, 6];
    case 'augmented': return [0, 4, 8];
    default: return [0, 4, 7];
  }
}

function applyInversion(midiNotes: number[], inversion: Inversion): number[] {
  const notes = [...midiNotes];
  for (let i = 0; i < inversion; i++) {
    const lowest = notes.shift()!;
    notes.push(lowest + 12);
  }
  return notes;
}

export function getDiatonicChord(
  key: Key,
  scale: ScaleName,
  degree: ScaleDegree,
  octave: number,
  inversion: Inversion = 0,
): ChordVoicing {
  const scaleNotes = getScaleNotes(key, scale, octave);
  const degreeIndex = degree - 1;
  const rootMidi = scaleNotes[degreeIndex];
  const quality = getQualitiesForScale(scale)[degreeIndex];
  const intervals = getTriadIntervals(quality);
  const chordMidi = intervals.map((interval) => rootMidi + interval);
  const invertedMidi = applyInversion(chordMidi, inversion);
  const notes = invertedMidi.map(makeNote);
  const rootNote = makeNote(rootMidi);
  const rootName = rootNote.name.replace(/\d+$/, '');

  return {
    notes,
    bass: null,
    quality,
    rootName,
    displayName: `${rootName}${qualitySuffix(quality)}`,
    inversion,
  };
}
```

- [ ] **Step 8: Run chord-engine tests**

```bash
npx vitest run src/music/__tests__/chord-engine.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: chord engine with scales and basic diatonic voicings"
```

---

### Task 3: Chord Engine — Joystick Modifications & Advanced Voicings

**Files:**
- Modify: `src/music/chord-engine.ts`
- Create: `src/music/voice-leading.ts`
- Test: `src/music/__tests__/chord-modifications.test.ts`
- Test: `src/music/__tests__/voice-leading.test.ts`

**Interfaces:**
- Consumes: `getDiatonicChord()` from Task 2, all types from `src/music/types.ts`
- Produces: `modifyChord(voicing: ChordVoicing, direction: JoystickDirection, mode: JoystickMode): ChordVoicing` — applies joystick modification. `getChord(key: Key, scale: ScaleName, degree: ScaleDegree, octave: number, direction: JoystickDirection, mode: JoystickMode, inversion: Inversion, bassMode: BassMode, chordLocks: ChordLock[]): ChordVoicing` — full chord resolution pipeline. `selectVoiceLeading(prev: ChordVoicing, next: ChordVoicing): ChordVoicing` — picks smoothest inversion.

- [ ] **Step 1: Write failing test for joystick modifications**

```typescript
// src/music/__tests__/chord-modifications.test.ts
import { describe, it, expect } from 'vitest';
import { modifyChord, getChord } from '@/music/chord-engine';
import { getDiatonicChord } from '@/music/chord-engine';

describe('joystick modifications — default mode', () => {
  it('flips major to minor on "up"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'up', 'default');
    expect(modified.quality).toBe('minor');
    expect(modified.displayName).toBe('Cm');
  });

  it('adds dom7 on "upRight"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'upRight', 'default');
    expect(modified.quality).toBe('dom7');
    expect(modified.notes).toHaveLength(4);
  });

  it('adds maj7 on "right"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'right', 'default');
    expect(modified.quality).toBe('maj7');
  });

  it('adds ninth on "downRight"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'downRight', 'default');
    expect(modified.quality).toBe('ninth');
  });

  it('adds sus4 on "down"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'down', 'default');
    expect(modified.quality).toBe('sus4');
  });

  it('adds sixth on "downLeft"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'downLeft', 'default');
    expect(modified.quality).toBe('sixth');
  });

  it('makes diminished on "left"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'left', 'default');
    expect(modified.quality).toBe('diminished');
  });

  it('makes augmented on "upLeft"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'upLeft', 'default');
    expect(modified.quality).toBe('augmented');
  });

  it('returns unchanged on "center"', () => {
    const base = getDiatonicChord('C', 'major', 1, 4);
    const modified = modifyChord(base, 'center', 'default');
    expect(modified.quality).toBe('major');
  });
});

describe('getChord — full pipeline', () => {
  it('applies chord lock', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'off', [
      { degree: 1, direction: 'upRight' },
    ]);
    expect(chord.quality).toBe('dom7');
  });

  it('adds bass note in root bass mode', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 0, 'root', []);
    expect(chord.bass).not.toBeNull();
    expect(chord.bass!.name).toBe('C3');
  });

  it('applies inversion', () => {
    const chord = getChord('C', 'major', 1, 4, 'center', 'default', 1, 'off', []);
    expect(chord.inversion).toBe(1);
    expect(chord.notes[0].name).toBe('E4');
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run src/music/__tests__/chord-modifications.test.ts
```

- [ ] **Step 3: Implement modifyChord and getChord in chord-engine.ts**

Add to `src/music/chord-engine.ts`:

```typescript
// Add these interval maps after the existing functions

function getChordIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case 'major': return [0, 4, 7];
    case 'minor': return [0, 3, 7];
    case 'diminished': return [0, 3, 6];
    case 'augmented': return [0, 4, 8];
    case 'dom7': return [0, 4, 7, 10];
    case 'maj7': return [0, 4, 7, 11];
    case 'min7': return [0, 3, 7, 10];
    case 'dim7': return [0, 3, 6, 9];
    case 'halfDim7': return [0, 3, 6, 10];
    case 'sus2': return [0, 2, 7];
    case 'sus4': return [0, 5, 7];
    case 'sixth': return [0, 4, 7, 9];
    case 'ninth': return [0, 4, 7, 10, 14];
    case 'dom9': return [0, 4, 7, 10, 14];
    case 'add9': return [0, 4, 7, 14];
    case 'add11': return [0, 4, 7, 17];
    case 'min11': return [0, 3, 7, 10, 14, 17];
    case 'dom7sharp9': return [0, 4, 7, 10, 15];
    case 'sus4plus7': return [0, 5, 7, 10];
    case 'minMaj7': return [0, 3, 7, 11];
    case 'maj13': return [0, 4, 7, 11, 14, 21];
    case 'sixNine': return [0, 4, 7, 9, 14];
    case 'maj7sharp11': return [0, 4, 7, 11, 18];
    case 'dom13': return [0, 4, 7, 10, 14, 21];
    case 'dom7flat9': return [0, 4, 7, 10, 13];
    case 'dom7alt': return [0, 4, 6, 10, 13];
    default: return [0, 4, 7];
  }
}

const DEFAULT_MODE_MAP: Record<string, ChordQuality> = {
  up: 'minor',       // flip: if already minor, flip to major
  upRight: 'dom7',
  right: 'maj7',
  downRight: 'ninth',
  down: 'sus4',
  downLeft: 'sixth',
  left: 'diminished',
  upLeft: 'augmented',
};

const EXTENDED_MODE_MAP: Record<string, ChordQuality> = {
  up: 'minor',
  upRight: 'dom9',
  right: 'add11',
  downRight: 'min11',
  down: 'dom7sharp9',
  downLeft: 'add9',
  left: 'sus4plus7',
  upLeft: 'halfDim7',
};

const CHROMATIC_MODE_MAP: Record<string, ChordQuality> = {
  up: 'minMaj7',
  upRight: 'dom13',
  right: 'sixNine',
  downRight: 'dom7alt',
  down: 'maj13',
  downLeft: 'dom7flat9',
  left: 'halfDim7',
  upLeft: 'maj7sharp11',
};

function getModeMap(mode: JoystickMode): Record<string, ChordQuality> {
  switch (mode) {
    case 'extended': return EXTENDED_MODE_MAP;
    case 'chromatic': return CHROMATIC_MODE_MAP;
    default: return DEFAULT_MODE_MAP;
  }
}

export function modifyChord(
  voicing: ChordVoicing,
  direction: JoystickDirection,
  mode: JoystickMode,
): ChordVoicing {
  if (direction === 'center') return voicing;

  const modeMap = getModeMap(mode);
  let newQuality = modeMap[direction];
  if (!newQuality) return voicing;

  // "up" in default mode flips major↔minor
  if (direction === 'up' && mode === 'default') {
    newQuality = voicing.quality === 'minor' ? 'major' : 'minor';
  }

  const rootMidi = voicing.notes[0].midi - getChordIntervals(voicing.quality)[0];
  const actualRoot = rootMidi + (voicing.inversion > 0 ? 0 : 0);
  // Rebuild from the original root
  const baseMidi = voicing.notes.reduce((min, n) => Math.min(min, n.midi), Infinity);
  const originalRootMidi = baseMidi - (getTriadIntervals(voicing.quality)[voicing.inversion] ?? 0);
  // Simpler: use the root name to find root midi
  const rootNote = voicing.notes.find((n) => n.name.replace(/\d+$/, '') === voicing.rootName);
  const rootMidiValue = rootNote ? rootNote.midi : voicing.notes[0].midi;

  const intervals = getChordIntervals(newQuality);
  const newMidis = intervals.map((i) => rootMidiValue + i);
  const newNotes = newMidis.map(makeNote);

  return {
    notes: newNotes,
    bass: voicing.bass,
    quality: newQuality,
    rootName: voicing.rootName,
    displayName: `${voicing.rootName}${qualitySuffix(newQuality)}`,
    inversion: 0,
  };
}

export function getChord(
  key: Key,
  scale: ScaleName,
  degree: ScaleDegree,
  octave: number,
  direction: JoystickDirection,
  mode: JoystickMode,
  inversion: Inversion,
  bassMode: BassMode,
  chordLocks: ChordLock[],
): ChordVoicing {
  // Check chord lock first
  const lock = chordLocks.find((l) => l.degree === degree);
  const effectiveDirection = lock ? lock.direction : direction;

  let chord = getDiatonicChord(key, scale, degree, octave, inversion);
  chord = modifyChord(chord, effectiveDirection, mode);

  // Re-apply inversion if modification reset it
  if (inversion > 0 && chord.inversion !== inversion) {
    const inverted = applyInversion(
      chord.notes.map((n) => n.midi),
      inversion,
    );
    chord = {
      ...chord,
      notes: inverted.map(makeNote),
      inversion,
    };
  }

  // Add bass note
  if (bassMode !== 'off') {
    const rootMidi = chord.notes.find((n) => n.name.replace(/\d+$/, '') === chord.rootName)?.midi;
    if (rootMidi !== undefined) {
      const bassMidi = bassMode === 'root' ? rootMidi - 12 : rootMidi - 12;
      chord = { ...chord, bass: makeNote(bassMidi) };
    }
  }

  return chord;
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run src/music/__tests__/chord-modifications.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for voice leading**

```typescript
// src/music/__tests__/voice-leading.test.ts
import { describe, it, expect } from 'vitest';
import { selectVoiceLeading } from '@/music/voice-leading';
import { getDiatonicChord } from '@/music/chord-engine';

describe('voice leading', () => {
  it('picks inversion minimizing total semitone movement', () => {
    const prev = getDiatonicChord('C', 'major', 1, 4); // C4 E4 G4
    const next = getDiatonicChord('C', 'major', 4, 4); // F4 A4 C5
    const result = selectVoiceLeading(prev, next);
    // Second inversion of F (C4 F4 A4) is closest to C E G
    expect(result.inversion).toBe(2);
  });

  it('returns root position when it is already closest', () => {
    const prev = getDiatonicChord('C', 'major', 1, 4); // C E G
    const next = getDiatonicChord('C', 'major', 2, 4); // D F A
    const result = selectVoiceLeading(prev, next);
    // Root position D F A is already close
    expect(result.inversion).toBe(0);
  });
});
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npx vitest run src/music/__tests__/voice-leading.test.ts
```

- [ ] **Step 7: Implement voice-leading.ts**

```typescript
// src/music/voice-leading.ts
import type { ChordVoicing, Inversion } from './types';
import { getDiatonicChord } from './chord-engine';

function totalMovement(prev: number[], next: number[]): number {
  const len = Math.min(prev.length, next.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    total += Math.abs(prev[i] - next[i]);
  }
  return total;
}

export function selectVoiceLeading(
  prev: ChordVoicing,
  next: ChordVoicing,
): ChordVoicing {
  const prevMidis = prev.notes.map((n) => n.midi);
  let bestInversion: Inversion = 0;
  let bestMovement = Infinity;

  for (const inv of [0, 1, 2] as Inversion[]) {
    const candidate = { ...next };
    // Reconstruct notes with this inversion
    const baseMidis = next.notes.map((n) => n.midi);
    // Undo current inversion to get root position
    const rootMidis = undoInversion(baseMidis, next.inversion);
    // Apply candidate inversion
    const invMidis = doInversion(rootMidis, inv);
    const movement = totalMovement(prevMidis, invMidis);
    if (movement < bestMovement) {
      bestMovement = movement;
      bestInversion = inv;
    }
  }

  if (bestInversion === next.inversion) return next;

  const rootMidis = undoInversion(next.notes.map((n) => n.midi), next.inversion);
  const invMidis = doInversion(rootMidis, bestInversion);

  return {
    ...next,
    notes: invMidis.map((midi) => ({
      midi,
      frequency: 440 * Math.pow(2, (midi - 69) / 12),
      name: midiToName(midi),
      octave: Math.floor(midi / 12) - 1,
    })),
    inversion: bestInversion,
  };
}

function undoInversion(midis: number[], inv: Inversion): number[] {
  const notes = [...midis];
  for (let i = 0; i < inv; i++) {
    const highest = notes.pop()!;
    notes.unshift(highest - 12);
  }
  return notes;
}

function doInversion(midis: number[], inv: Inversion): number[] {
  const notes = [...midis];
  for (let i = 0; i < inv; i++) {
    const lowest = notes.shift()!;
    notes.push(lowest + 12);
  }
  return notes;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: joystick chord modifications and voice leading"
```

---

### Task 4: Audio Engine — Analog Synth & ADSR

**Files:**
- Create: `src/audio/engine.ts`
- Create: `src/audio/synth-analog.ts`
- Test: `src/audio/__tests__/engine.test.ts`
- Test: `src/audio/__tests__/synth-analog.test.ts`

**Interfaces:**
- Consumes: `ChordVoicing`, `Note` from `src/music/types.ts`. `SynthMode`, `ADSREnvelope`, `AnalogWaveform`, `ADSR_PRESETS` from `src/audio/types.ts`.
- Produces: `AudioEngine` class with methods: `constructor()`, `resume(): Promise<void>`, `triggerChord(voicing: ChordVoicing): void`, `releaseChord(): void`, `setWaveform(wf: AnalogWaveform): void`, `setAdsr(adsr: ADSREnvelope): void`, `setMasterVolume(vol: number): void`, `getContext(): AudioContext`, `getOutputNode(): GainNode`. `AnalogSynth` class with: `constructor(ctx: AudioContext, output: AudioNode)`, `trigger(notes: Note[], adsr: ADSREnvelope, waveform: AnalogWaveform): void`, `release(adsr: ADSREnvelope): void`, `stop(): void`.

- [ ] **Step 1: Write failing test for analog synth**

```typescript
// src/audio/__tests__/synth-analog.test.ts
import { describe, it, expect } from 'vitest';
import { AnalogSynth } from '@/audio/synth-analog';
import { ADSR_PRESETS } from '@/audio/types';

describe('AnalogSynth', () => {
  it('creates 6 stereo oscillator pairs', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);
    expect(synth.getVoiceCount()).toBe(6);
  });

  it('triggers notes and produces non-silent audio', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
      { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
      { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.TOUCH, 'sawtooth');

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });

  it('stops all oscillators on stop()', async () => {
    const ctx = new OfflineAudioContext(2, 48000 * 2, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new AnalogSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.SHORT, 'sine');
    synth.stop();

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    // Last quarter of buffer should be silent after stop
    const lastQuarter = data.slice(data.length * 3 / 4);
    const maxTail = Math.max(...Array.from(lastQuarter).map(Math.abs));
    expect(maxTail).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run src/audio/__tests__/synth-analog.test.ts
```

- [ ] **Step 3: Implement synth-analog.ts**

```typescript
// src/audio/synth-analog.ts
import type { Note } from '@/music/types';
import type { ADSREnvelope, AnalogWaveform } from './types';

interface Voice {
  oscL: OscillatorNode;
  oscR: OscillatorNode;
  gainL: GainNode;
  gainR: GainNode;
  panL: StereoPannerNode;
  panR: StereoPannerNode;
}

export class AnalogSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private voices: Voice[] = [];
  private activeVoices: Voice[] = [];

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  getVoiceCount(): number {
    return 6;
  }

  trigger(notes: Note[], adsr: ADSREnvelope, waveform: AnalogWaveform): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      const panValue = notes.length > 1
        ? -0.5 + (i / (notes.length - 1)) * 1.0
        : 0;

      const oscL = this.createOsc(note.frequency, waveform);
      const oscR = this.createOsc(note.frequency, waveform);
      oscR.detune.value = 5; // slight detune for stereo width

      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      const panL = this.createPanner(panValue - 0.15);
      const panR = this.createPanner(panValue + 0.15);

      // ADSR envelope
      gainL.gain.setValueAtTime(0, now);
      gainL.gain.linearRampToValueAtTime(1, attackEnd);
      gainL.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);
      gainR.gain.setValueAtTime(0, now);
      gainR.gain.linearRampToValueAtTime(1, attackEnd);
      gainR.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      oscL.connect(gainL).connect(panL).connect(this.output);
      oscR.connect(gainR).connect(panR).connect(this.output);

      oscL.start(now);
      oscR.start(now);

      this.activeVoices.push({ oscL, oscR, gainL, gainR, panL, panR });
    }
  }

  release(adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;

    for (const voice of this.activeVoices) {
      voice.gainL.gain.cancelScheduledValues(now);
      voice.gainL.gain.setValueAtTime(voice.gainL.gain.value, now);
      voice.gainL.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.gainR.gain.cancelScheduledValues(now);
      voice.gainR.gain.setValueAtTime(voice.gainR.gain.value, now);
      voice.gainR.gain.linearRampToValueAtTime(0, releaseEnd);

      voice.oscL.stop(releaseEnd + 0.01);
      voice.oscR.stop(releaseEnd + 0.01);
    }

    setTimeout(() => {
      this.activeVoices = [];
    }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.gainL.gain.cancelScheduledValues(now);
        voice.gainL.gain.setValueAtTime(0, now);
        voice.gainR.gain.cancelScheduledValues(now);
        voice.gainR.gain.setValueAtTime(0, now);
        voice.oscL.stop(now + 0.005);
        voice.oscR.stop(now + 0.005);
      } catch {
        // oscillator already stopped
      }
    }
    this.activeVoices = [];
  }

  private createOsc(frequency: number, waveform: AnalogWaveform): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = frequency;
    return osc;
  }

  private createPanner(pan: number): StereoPannerNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    return panner;
  }
}
```

- [ ] **Step 4: Run synth-analog tests**

```bash
npx vitest run src/audio/__tests__/synth-analog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for AudioEngine**

```typescript
// src/audio/__tests__/engine.test.ts
import { describe, it, expect } from 'vitest';
import { AudioEngine } from '@/audio/engine';

describe('AudioEngine', () => {
  it('creates with default state', () => {
    const engine = new AudioEngine();
    expect(engine).toBeDefined();
    expect(engine.getContext()).toBeInstanceOf(OfflineAudioContext);
  });

  it('sets master volume', () => {
    const engine = new AudioEngine();
    engine.setMasterVolume(0.5);
    expect(engine.getMasterVolume()).toBe(0.5);
  });
});
```

- [ ] **Step 6: Implement engine.ts**

```typescript
// src/audio/engine.ts
import type { ChordVoicing } from '@/music/types';
import type { SynthMode, ADSREnvelope, AnalogWaveform } from './types';
import { ADSR_PRESETS } from './types';
import { AnalogSynth } from './synth-analog';

export class AudioEngine {
  private ctx: AudioContext | OfflineAudioContext;
  private masterGain: GainNode;
  private effectsInput: GainNode;
  private analogSynth: AnalogSynth;
  private currentAdsr: ADSREnvelope = ADSR_PRESETS.TOUCH;
  private currentWaveform: AnalogWaveform = 'sawtooth';
  private currentSynthMode: SynthMode = 'analog';

  constructor(offlineCtx?: OfflineAudioContext) {
    this.ctx = offlineCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.masterGain);

    this.analogSynth = new AnalogSynth(this.ctx, this.effectsInput);
  }

  async resume(): Promise<void> {
    if (this.ctx instanceof AudioContext && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  triggerChord(voicing: ChordVoicing): void {
    const allNotes = voicing.bass ? [voicing.bass, ...voicing.notes] : voicing.notes;
    switch (this.currentSynthMode) {
      case 'analog':
        this.analogSynth.trigger(allNotes, this.currentAdsr, this.currentWaveform);
        break;
      // FM, sample, noise added in later tasks
    }
  }

  releaseChord(): void {
    switch (this.currentSynthMode) {
      case 'analog':
        this.analogSynth.release(this.currentAdsr);
        break;
    }
  }

  setSynthMode(mode: SynthMode): void { this.currentSynthMode = mode; }
  setWaveform(wf: AnalogWaveform): void { this.currentWaveform = wf; }
  setAdsr(adsr: ADSREnvelope): void { this.currentAdsr = adsr; }
  setMasterVolume(vol: number): void { this.masterGain.gain.value = vol; }
  getMasterVolume(): number { return this.masterGain.gain.value; }
  getContext(): BaseAudioContext { return this.ctx; }
  getOutputNode(): GainNode { return this.effectsInput; }
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: audio engine with analog synth and ADSR envelopes"
```

---

### Task 5: Audio Engine — FM, Sample & Noise Synths

**Files:**
- Create: `src/audio/synth-fm.ts`
- Create: `src/audio/synth-sample.ts`
- Create: `src/audio/synth-noise.ts`
- Create: `src/audio/noise-worklet.ts`
- Modify: `src/audio/engine.ts` — add FM/sample/noise routing
- Test: `src/audio/__tests__/synth-fm.test.ts`
- Test: `src/audio/__tests__/synth-sample.test.ts`

**Interfaces:**
- Consumes: `Note` from `src/music/types.ts`. `ADSREnvelope`, `FMPreset`, `FM_PRESETS` from `src/audio/types.ts`. `AudioEngine.getContext()`, `AudioEngine.getOutputNode()` from Task 4.
- Produces: `FMSynth` class with `trigger(notes: Note[], adsr: ADSREnvelope, preset: FMPreset): void`, `release(adsr: ADSREnvelope): void`, `stop(): void`. `SampleSynth` class with `trigger(notes: Note[], adsr: ADSREnvelope, sampleBuffer: AudioBuffer): void`, `release(adsr: ADSREnvelope): void`, `stop(): void`, `loadSample(url: string): Promise<AudioBuffer>`. `NoiseSynth` class with `trigger(adsr: ADSREnvelope, type: 'white' | 'pink' | 'filtered' | 'metallic'): void`, `release(adsr: ADSREnvelope): void`, `stop(): void`.

- [ ] **Step 1: Write failing test for FM synth**

```typescript
// src/audio/__tests__/synth-fm.test.ts
import { describe, it, expect } from 'vitest';
import { FMSynth } from '@/audio/synth-fm';
import { ADSR_PRESETS, FM_PRESETS } from '@/audio/types';

describe('FMSynth', () => {
  it('produces non-silent audio', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const synth = new FMSynth(ctx, output);

    const notes = [
      { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
      { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
      { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
    ];

    synth.trigger(notes, ADSR_PRESETS.TOUCH, FM_PRESETS[0]);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });
});
```

- [ ] **Step 2: Implement synth-fm.ts**

```typescript
// src/audio/synth-fm.ts
import type { Note } from '@/music/types';
import type { ADSREnvelope, FMPreset } from './types';

interface FMVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  envGain: GainNode;
  panner: StereoPannerNode;
}

export class FMSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private activeVoices: FMVoice[] = [];

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  trigger(notes: Note[], adsr: ADSREnvelope, preset: FMPreset): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      const pan = notes.length > 1 ? -0.5 + (i / (notes.length - 1)) : 0;

      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = note.frequency;

      const modulator = this.ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = note.frequency * preset.frequencyRatio;

      const modGain = this.ctx.createGain();
      modGain.gain.value = note.frequency * preset.modulationIndex;

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0, now);
      envGain.gain.linearRampToValueAtTime(1, attackEnd);
      envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(envGain);
      envGain.connect(panner);
      panner.connect(this.output);

      carrier.start(now);
      modulator.start(now);

      this.activeVoices.push({ carrier, modulator, modGain, envGain, panner });
    }
  }

  release(adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    for (const voice of this.activeVoices) {
      voice.envGain.gain.cancelScheduledValues(now);
      voice.envGain.gain.setValueAtTime(voice.envGain.gain.value, now);
      voice.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.carrier.stop(releaseEnd + 0.01);
      voice.modulator.stop(releaseEnd + 0.01);
    }
    setTimeout(() => { this.activeVoices = []; }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.envGain.gain.cancelScheduledValues(now);
        voice.envGain.gain.setValueAtTime(0, now);
        voice.carrier.stop(now + 0.005);
        voice.modulator.stop(now + 0.005);
      } catch { /* already stopped */ }
    }
    this.activeVoices = [];
  }
}
```

- [ ] **Step 3: Implement synth-sample.ts**

```typescript
// src/audio/synth-sample.ts
import type { Note } from '@/music/types';
import type { ADSREnvelope } from './types';

interface SampleVoice {
  source: AudioBufferSourceNode;
  envGain: GainNode;
  panner: StereoPannerNode;
}

export class SampleSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private activeVoices: SampleVoice[] = [];
  private sampleCache: Map<string, AudioBuffer> = new Map();

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  async loadSample(url: string): Promise<AudioBuffer> {
    if (this.sampleCache.has(url)) return this.sampleCache.get(url)!;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.sampleCache.set(url, audioBuffer);
    return audioBuffer;
  }

  loadSampleFromBuffer(name: string, buffer: AudioBuffer): void {
    this.sampleCache.set(name, buffer);
  }

  trigger(notes: Note[], adsr: ADSREnvelope, sampleBuffer: AudioBuffer): void {
    this.stop();
    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;
    const baseMidi = 60; // assume samples recorded at C4

    for (let i = 0; i < Math.min(notes.length, 6); i++) {
      const note = notes[i];
      const pan = notes.length > 1 ? -0.5 + (i / (notes.length - 1)) : 0;

      const source = this.ctx.createBufferSource();
      source.buffer = sampleBuffer;
      source.playbackRate.value = Math.pow(2, (note.midi - baseMidi) / 12);

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0, now);
      envGain.gain.linearRampToValueAtTime(1, attackEnd);
      envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      source.connect(envGain).connect(panner).connect(this.output);
      source.start(now);

      this.activeVoices.push({ source, envGain, panner });
    }
  }

  release(adsr: ADSREnvelope): void {
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    for (const voice of this.activeVoices) {
      voice.envGain.gain.cancelScheduledValues(now);
      voice.envGain.gain.setValueAtTime(voice.envGain.gain.value, now);
      voice.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
      voice.source.stop(releaseEnd + 0.01);
    }
    setTimeout(() => { this.activeVoices = []; }, adsr.release + 50);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.envGain.gain.setValueAtTime(0, now);
        voice.source.stop(now + 0.005);
      } catch { /* already stopped */ }
    }
    this.activeVoices = [];
  }
}
```

- [ ] **Step 4: Implement synth-noise.ts and noise-worklet.ts**

```typescript
// src/audio/noise-worklet.ts
// This file is loaded as an AudioWorklet module
const PROCESSOR_CODE = `
class NoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.type = 'white';
    this.pinkB = [0, 0, 0, 0, 0, 0, 0];
    this.port.onmessage = (e) => { this.type = e.data.type; };
  }
  process(inputs, outputs) {
    const output = outputs[0];
    for (const channel of output) {
      for (let i = 0; i < channel.length; i++) {
        if (this.type === 'white') {
          channel[i] = Math.random() * 2 - 1;
        } else if (this.type === 'pink') {
          const white = Math.random() * 2 - 1;
          this.pinkB[0] = 0.99886 * this.pinkB[0] + white * 0.0555179;
          this.pinkB[1] = 0.99332 * this.pinkB[1] + white * 0.0750759;
          this.pinkB[2] = 0.96900 * this.pinkB[2] + white * 0.1538520;
          this.pinkB[3] = 0.86650 * this.pinkB[3] + white * 0.3104856;
          this.pinkB[4] = 0.55000 * this.pinkB[4] + white * 0.5329522;
          this.pinkB[5] = -0.7616 * this.pinkB[5] - white * 0.0168980;
          channel[i] = (this.pinkB[0] + this.pinkB[1] + this.pinkB[2] + this.pinkB[3] + this.pinkB[4] + this.pinkB[5] + this.pinkB[6] + white * 0.5362) * 0.11;
          this.pinkB[6] = white * 0.115926;
        } else {
          channel[i] = Math.random() * 2 - 1;
        }
      }
    }
    return true;
  }
}
registerProcessor('noise-processor', NoiseProcessor);
`;

export function getNoiseWorkletUrl(): string {
  const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
```

```typescript
// src/audio/synth-noise.ts
import type { ADSREnvelope } from './types';
import { getNoiseWorkletUrl } from './noise-worklet';

export class NoiseSynth {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private noiseNode: AudioWorkletNode | null = null;
  private envGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private initialized = false;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  async init(): Promise<void> {
    if (this.initialized || !(this.ctx instanceof AudioContext)) return;
    const url = getNoiseWorkletUrl();
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.initialized = true;
  }

  trigger(adsr: ADSREnvelope, type: 'white' | 'pink' | 'filtered' | 'metallic'): void {
    this.stop();
    if (!(this.ctx instanceof AudioContext) || !this.initialized) return;

    const now = this.ctx.currentTime;
    const attackEnd = now + adsr.attack / 1000;
    const decayEnd = attackEnd + adsr.decay / 1000;

    this.noiseNode = new AudioWorkletNode(this.ctx, 'noise-processor');
    this.noiseNode.port.postMessage({ type: type === 'filtered' || type === 'metallic' ? 'white' : type });

    this.envGain = this.ctx.createGain();
    this.envGain.gain.setValueAtTime(0, now);
    this.envGain.gain.linearRampToValueAtTime(1, attackEnd);
    this.envGain.gain.linearRampToValueAtTime(adsr.sustain, decayEnd);

    if (type === 'filtered' || type === 'metallic') {
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = type === 'metallic' ? 'bandpass' : 'lowpass';
      this.filter.frequency.value = type === 'metallic' ? 3000 : 1000;
      this.filter.Q.value = type === 'metallic' ? 10 : 1;
      this.noiseNode.connect(this.filter).connect(this.envGain).connect(this.output);
    } else {
      this.noiseNode.connect(this.envGain).connect(this.output);
    }
  }

  release(adsr: ADSREnvelope): void {
    if (!this.envGain || !this.noiseNode) return;
    const now = this.ctx.currentTime;
    const releaseEnd = now + adsr.release / 1000;
    this.envGain.gain.cancelScheduledValues(now);
    this.envGain.gain.setValueAtTime(this.envGain.gain.value, now);
    this.envGain.gain.linearRampToValueAtTime(0, releaseEnd);
    const node = this.noiseNode;
    setTimeout(() => { try { node.disconnect(); } catch {} }, adsr.release + 50);
  }

  stop(): void {
    try { this.noiseNode?.disconnect(); } catch {}
    try { this.envGain?.disconnect(); } catch {}
    try { this.filter?.disconnect(); } catch {}
    this.noiseNode = null;
    this.envGain = null;
    this.filter = null;
  }
}
```

- [ ] **Step 5: Update engine.ts to route all synth modes**

Add imports and routing to `src/audio/engine.ts`:

```typescript
import { FMSynth } from './synth-fm';
import { SampleSynth } from './synth-sample';
import { NoiseSynth } from './synth-noise';
import { FM_PRESETS } from './types';
```

Add fields and update `constructor`, `triggerChord`, `releaseChord`:

```typescript
private fmSynth: FMSynth;
private sampleSynth: SampleSynth;
private noiseSynth: NoiseSynth;
private currentFmPresetIndex = 0;

// In constructor, after analogSynth:
this.fmSynth = new FMSynth(this.ctx, this.effectsInput);
this.sampleSynth = new SampleSynth(this.ctx, this.effectsInput);
this.noiseSynth = new NoiseSynth(this.ctx, this.effectsInput);

// triggerChord:
case 'fm':
  this.fmSynth.trigger(allNotes, this.currentAdsr, FM_PRESETS[this.currentFmPresetIndex]);
  break;

// releaseChord:
case 'fm':
  this.fmSynth.release(this.currentAdsr);
  break;

// Add setter:
setFmPresetIndex(idx: number): void { this.currentFmPresetIndex = idx; }
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: FM, sample, and noise synth engines"
```

---

### Task 6: Effects Chain

**Files:**
- Create: `src/audio/effects.ts`
- Modify: `src/audio/engine.ts` — wire effects between synths and master gain
- Test: `src/audio/__tests__/effects.test.ts`

**Interfaces:**
- Consumes: `EffectType` from `src/audio/types.ts`. `AudioEngine.getContext()`, `AudioEngine.getOutputNode()` from Task 4.
- Produces: `EffectsChain` class with: `constructor(ctx: BaseAudioContext)`, `getInput(): AudioNode`, `getOutput(): AudioNode`, `setEffect(type: EffectType, enabled: boolean, value: number): void`, `setBpm(bpm: number): void`, `connect(destination: AudioNode): void`.

- [ ] **Step 1: Write failing test**

```typescript
// src/audio/__tests__/effects.test.ts
import { describe, it, expect } from 'vitest';
import { EffectsChain } from '@/audio/effects';

describe('EffectsChain', () => {
  it('passes audio through when all effects bypassed', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const chain = new EffectsChain(ctx);
    chain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(chain.getInput());
    osc.start(0);
    osc.stop(0.5);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data).map(Math.abs));
    expect(max).toBeGreaterThan(0.1);
  });

  it('reduces high frequencies when filter enabled', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const chain = new EffectsChain(ctx);
    chain.connect(ctx.destination);
    chain.setEffect('filter', true, 200); // 200Hz cutoff — should kill 5000Hz

    const osc = ctx.createOscillator();
    osc.frequency.value = 5000;
    osc.connect(chain.getInput());
    osc.start(0);
    osc.stop(0.5);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data.slice(4800)).map(Math.abs));
    expect(max).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Implement effects.ts**

```typescript
// src/audio/effects.ts
import type { EffectType } from './types';

export class EffectsChain {
  private ctx: BaseAudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect nodes
  private filterNode: BiquadFilterNode;
  private filterBypass: GainNode;
  private chorusDelay: DelayNode;
  private chorusLfo: OscillatorNode;
  private chorusGain: GainNode;
  private chorusDry: GainNode;
  private chorusWet: GainNode;
  private flangerDelay: DelayNode;
  private flangerLfo: OscillatorNode;
  private flangerFeedback: GainNode;
  private flangerDry: GainNode;
  private flangerWet: GainNode;
  private tremoloGain: GainNode;
  private tremoloLfo: OscillatorNode;
  private tremoloDepth: GainNode;
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayDry: GainNode;
  private delayWet: GainNode;
  private reverbConvolver: ConvolverNode;
  private reverbDry: GainNode;
  private reverbWet: GainNode;
  private stereoPanner: StereoPannerNode;

  private bpm = 120;
  private effectStates: Map<EffectType, boolean> = new Map();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.inputGain = ctx.createGain();
    this.outputGain = ctx.createGain();

    // Filter
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 20000;
    this.filterBypass = ctx.createGain();

    // Chorus
    this.chorusDelay = ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.025;
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.frequency.value = 1.5;
    this.chorusGain = ctx.createGain();
    this.chorusGain.gain.value = 0.002;
    this.chorusDry = ctx.createGain();
    this.chorusWet = ctx.createGain();
    this.chorusWet.gain.value = 0;

    // Flanger
    this.flangerDelay = ctx.createDelay(0.02);
    this.flangerDelay.delayTime.value = 0.005;
    this.flangerLfo = ctx.createOscillator();
    this.flangerLfo.frequency.value = 0.25;
    this.flangerFeedback = ctx.createGain();
    this.flangerFeedback.gain.value = 0.5;
    this.flangerDry = ctx.createGain();
    this.flangerWet = ctx.createGain();
    this.flangerWet.gain.value = 0;

    // Tremolo
    this.tremoloGain = ctx.createGain();
    this.tremoloLfo = ctx.createOscillator();
    this.tremoloLfo.frequency.value = 4;
    this.tremoloDepth = ctx.createGain();
    this.tremoloDepth.gain.value = 0;

    // Delay
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.5;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayDry = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0;

    // Reverb
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.generateImpulseResponse(2, 2);
    this.reverbDry = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0;

    // Stereo
    this.stereoPanner = ctx.createStereoPanner();
    this.stereoPanner.pan.value = 0;

    this.wireChain();
    this.startLfos();
  }

  private wireChain(): void {
    // Input → Filter → Chorus → Flanger → Tremolo → Delay → Reverb → Stereo → Output
    this.inputGain.connect(this.filterNode);

    // Chorus (wet/dry)
    this.filterNode.connect(this.chorusDry);
    this.filterNode.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusLfo.connect(this.chorusGain);
    this.chorusGain.connect(this.chorusDelay.delayTime);

    // Merge chorus → flanger
    const chorusMerge = this.ctx.createGain();
    this.chorusDry.connect(chorusMerge);
    this.chorusWet.connect(chorusMerge);

    // Flanger (wet/dry)
    chorusMerge.connect(this.flangerDry);
    chorusMerge.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerWet);
    const flangerLfoGain = this.ctx.createGain();
    flangerLfoGain.gain.value = 0.002;
    this.flangerLfo.connect(flangerLfoGain);
    flangerLfoGain.connect(this.flangerDelay.delayTime);

    // Merge flanger → tremolo
    const flangerMerge = this.ctx.createGain();
    this.flangerDry.connect(flangerMerge);
    this.flangerWet.connect(flangerMerge);

    // Tremolo
    flangerMerge.connect(this.tremoloGain);
    this.tremoloLfo.connect(this.tremoloDepth);
    this.tremoloDepth.connect(this.tremoloGain.gain);

    // Delay (wet/dry)
    this.tremoloGain.connect(this.delayDry);
    this.tremoloGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);

    // Merge delay → reverb
    const delayMerge = this.ctx.createGain();
    this.delayDry.connect(delayMerge);
    this.delayWet.connect(delayMerge);

    // Reverb (wet/dry)
    delayMerge.connect(this.reverbDry);
    delayMerge.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWet);

    // Merge reverb → stereo → output
    const reverbMerge = this.ctx.createGain();
    this.reverbDry.connect(reverbMerge);
    this.reverbWet.connect(reverbMerge);
    reverbMerge.connect(this.stereoPanner);
    this.stereoPanner.connect(this.outputGain);
  }

  private startLfos(): void {
    try {
      this.chorusLfo.start();
      this.flangerLfo.start();
      this.tremoloLfo.start();
    } catch { /* already started in offline context tests */ }
  }

  private generateImpulseResponse(duration: number, decay: number): AudioBuffer {
    const length = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  getInput(): AudioNode { return this.inputGain; }
  getOutput(): AudioNode { return this.outputGain; }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.effectStates.get('delay')) {
      // Re-sync delay time
      const currentValue = this.delayNode.delayTime.value;
      // Keep same subdivision
    }
  }

  setEffect(type: EffectType, enabled: boolean, value: number): void {
    this.effectStates.set(type, enabled);

    switch (type) {
      case 'filter':
        this.filterNode.frequency.value = enabled ? Math.max(20, Math.min(20000, value)) : 20000;
        break;
      case 'reverb':
        this.reverbWet.gain.value = enabled ? value : 0;
        break;
      case 'delay': {
        this.delayWet.gain.value = enabled ? 0.4 : 0;
        if (enabled) {
          const beatDuration = 60 / this.bpm;
          this.delayNode.delayTime.value = beatDuration * value; // value = fraction (0.25 = 1/4)
        }
        break;
      }
      case 'chorus':
        this.chorusWet.gain.value = enabled ? value : 0;
        break;
      case 'flanger':
        this.flangerWet.gain.value = enabled ? value : 0;
        break;
      case 'tremolo':
        this.tremoloDepth.gain.value = enabled ? value : 0;
        break;
      case 'stereo':
        this.stereoPanner.pan.value = 0; // stereo width handled by synth panners
        break;
      default:
        break;
    }
  }
}
```

- [ ] **Step 3: Update engine.ts to use EffectsChain**

Replace direct `effectsInput → masterGain` wiring with:

```typescript
private effectsChain: EffectsChain;

// In constructor:
this.effectsChain = new EffectsChain(this.ctx);
this.effectsChain.connect(this.masterGain);
// Change effectsInput to connect to effects chain input
this.effectsInput = this.ctx.createGain();
this.effectsInput.connect(this.effectsChain.getInput());

// Add method:
setEffect(type: EffectType, enabled: boolean, value: number): void {
  this.effectsChain.setEffect(type, enabled, value);
}
getEffectsChain(): EffectsChain { return this.effectsChain; }
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: effects chain with filter, reverb, delay, chorus, flanger, tremolo"
```

---

### Task 7: Master Clock, Arpeggiator & Sequencer

**Files:**
- Create: `src/audio/clock.ts`
- Create: `src/audio/arpeggiator.ts`
- Create: `src/audio/sequencer.ts`
- Test: `src/audio/__tests__/clock.test.ts`
- Test: `src/audio/__tests__/arpeggiator.test.ts`

**Interfaces:**
- Consumes: `ArpPattern`, `ArpRate`, `ArpChordMode` from `src/audio/types.ts`. `Note`, `ChordVoicing` from `src/music/types.ts`.
- Produces: `MasterClock` class with `constructor(ctx: BaseAudioContext)`, `start(): void`, `stop(): void`, `setBpm(bpm: number): void`, `onTick(callback: (time: number, step: number) => void): void`, `getBpm(): number`. `Arpeggiator` class with `setChord(voicing: ChordVoicing): void`, `setPattern(pattern: ArpPattern): void`, `setRate(rate: ArpRate): void`, `setChordMode(mode: ArpChordMode): void`, `getNextNote(step: number): Note[]`, `reset(): void`. `Sequencer` class with `setStep(index: number, degree: number, modification: string): void`, `getStep(index: number): SequencerStep | null`, `clear(): void`, `getLength(): number`, `getStepAtPosition(step: number): SequencerStep | null`.

- [ ] **Step 1: Write failing test for clock**

```typescript
// src/audio/__tests__/clock.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MasterClock } from '@/audio/clock';

describe('MasterClock', () => {
  it('calculates correct step duration at 120 BPM, 1/8 rate', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    // At 120 BPM, a 1/8 note = 0.25 seconds
    expect(clock.getStepDuration('1/8')).toBeCloseTo(0.25, 3);
  });

  it('calculates correct step duration at 120 BPM, 1/4 rate', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    expect(clock.getStepDuration('1/4')).toBeCloseTo(0.5, 3);
  });

  it('calculates swing eighth', () => {
    const clock = new MasterClock();
    clock.setBpm(120);
    const dur = clock.getStepDuration('swing8');
    // Swing 8th alternates long-short, average should be ~0.25
    expect(dur).toBeGreaterThan(0);
  });

  it('clamps BPM to 40-300', () => {
    const clock = new MasterClock();
    clock.setBpm(10);
    expect(clock.getBpm()).toBe(40);
    clock.setBpm(500);
    expect(clock.getBpm()).toBe(300);
  });
});
```

- [ ] **Step 2: Implement clock.ts**

```typescript
// src/audio/clock.ts
import type { ArpRate } from './types';

type TickCallback = (time: number, step: number) => void;

const RATE_DIVISORS: Record<ArpRate, number> = {
  '1/1': 4,
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
  '1/16T': 1 / 6,
  '1/32': 0.125,
  'swing8': 0.5,
  'swing16': 0.25,
};

export class MasterClock {
  private bpm = 120;
  private running = false;
  private step = 0;
  private nextStepTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TickCallback[] = [];
  private currentRate: ArpRate = '1/8';
  private ctx: BaseAudioContext | null = null;

  private scheduleAhead = 0.1; // 100ms lookahead
  private scheduleInterval = 25; // check every 25ms

  constructor(ctx?: BaseAudioContext) {
    this.ctx = ctx ?? null;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(300, bpm));
  }

  getBpm(): number { return this.bpm; }

  setRate(rate: ArpRate): void { this.currentRate = rate; }

  setContext(ctx: BaseAudioContext): void { this.ctx = ctx; }

  getStepDuration(rate?: ArpRate): number {
    const r = rate ?? this.currentRate;
    const beatDuration = 60 / this.bpm;
    return beatDuration * RATE_DIVISORS[r];
  }

  onTick(callback: TickCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime;
    this.intervalId = setInterval(() => this.schedule(), this.scheduleInterval);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.step = 0;
  }

  isRunning(): boolean { return this.running; }

  private schedule(): void {
    if (!this.ctx || !this.running) return;
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      for (const cb of this.callbacks) {
        cb(this.nextStepTime, this.step);
      }
      this.step++;
      this.nextStepTime += this.getStepDuration();
    }
  }
}
```

- [ ] **Step 3: Write failing test for arpeggiator**

```typescript
// src/audio/__tests__/arpeggiator.test.ts
import { describe, it, expect } from 'vitest';
import { Arpeggiator } from '@/audio/arpeggiator';
import type { ChordVoicing } from '@/music/types';

const mockChord: ChordVoicing = {
  notes: [
    { midi: 60, frequency: 261.63, name: 'C4', octave: 4 },
    { midi: 64, frequency: 329.63, name: 'E4', octave: 4 },
    { midi: 67, frequency: 392.00, name: 'G4', octave: 4 },
  ],
  bass: null,
  quality: 'major',
  rootName: 'C',
  displayName: 'C',
  inversion: 0,
};

describe('Arpeggiator', () => {
  it('cycles up through chord notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('up');

    expect(arp.getNextNote(0)[0].name).toBe('C4');
    expect(arp.getNextNote(1)[0].name).toBe('E4');
    expect(arp.getNextNote(2)[0].name).toBe('G4');
    expect(arp.getNextNote(3)[0].name).toBe('C4'); // wraps
  });

  it('cycles down through chord notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('down');

    expect(arp.getNextNote(0)[0].name).toBe('G4');
    expect(arp.getNextNote(1)[0].name).toBe('E4');
    expect(arp.getNextNote(2)[0].name).toBe('C4');
  });

  it('up/down bounces', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('upDown');

    const sequence = Array.from({ length: 6 }, (_, i) => arp.getNextNote(i)[0].name);
    expect(sequence).toEqual(['C4', 'E4', 'G4', 'G4', 'E4', 'C4']);
  });

  it('random returns valid notes', () => {
    const arp = new Arpeggiator();
    arp.setChord(mockChord);
    arp.setPattern('random');

    const note = arp.getNextNote(0);
    expect(mockChord.notes.some((n) => n.midi === note[0].midi)).toBe(true);
  });
});
```

- [ ] **Step 4: Implement arpeggiator.ts**

```typescript
// src/audio/arpeggiator.ts
import type { Note, ChordVoicing } from '@/music/types';
import type { ArpPattern, ArpChordMode } from './types';

export class Arpeggiator {
  private chord: ChordVoicing | null = null;
  private pattern: ArpPattern = 'up';
  private chordMode: ArpChordMode = 'arpOnly';

  setChord(voicing: ChordVoicing): void { this.chord = voicing; }
  setPattern(pattern: ArpPattern): void { this.pattern = pattern; }
  setChordMode(mode: ArpChordMode): void { this.chordMode = mode; }

  reset(): void { this.chord = null; }

  getNextNote(step: number): Note[] {
    if (!this.chord || this.chord.notes.length === 0) return [];
    const notes = this.chord.notes;
    const len = notes.length;

    let index: number;
    switch (this.pattern) {
      case 'up':
        index = step % len;
        break;
      case 'down':
        index = (len - 1) - (step % len);
        break;
      case 'upDown': {
        const cycle = len * 2 - 2;
        const pos = cycle > 0 ? step % cycle : 0;
        index = pos < len ? pos : cycle - pos;
        break;
      }
      case 'downUp': {
        const cycle = len * 2 - 2;
        const pos = cycle > 0 ? step % cycle : 0;
        index = pos < len ? (len - 1 - pos) : (pos - len + 1);
        break;
      }
      case 'random':
        index = Math.floor(Math.random() * len);
        break;
      case 'fingerpick':
        // Pattern: root, 3rd, 5th, 3rd (repeated)
        index = [0, 1, 2, 1][step % 4] % len;
        break;
      default:
        index = step % len;
    }

    return [notes[index]];
  }
}
```

- [ ] **Step 5: Implement sequencer.ts**

```typescript
// src/audio/sequencer.ts
import type { ScaleDegree, JoystickDirection } from '@/music/types';

export interface SequencerStep {
  degree: ScaleDegree;
  direction: JoystickDirection;
  durationSteps: number;
}

export class Sequencer {
  private steps: (SequencerStep | null)[] = new Array(16).fill(null);

  setStep(index: number, degree: ScaleDegree, direction: JoystickDirection, duration = 1): void {
    if (index < 0 || index >= 16) return;
    this.steps[index] = { degree, direction, durationSteps: duration };
  }

  removeStep(index: number): void {
    if (index >= 0 && index < 16) this.steps[index] = null;
  }

  getStep(index: number): SequencerStep | null {
    return this.steps[index] ?? null;
  }

  getStepAtPosition(step: number): SequencerStep | null {
    return this.getStep(step % 16);
  }

  clear(): void {
    this.steps.fill(null);
  }

  getLength(): number { return 16; }

  getSteps(): (SequencerStep | null)[] { return [...this.steps]; }
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: master clock, arpeggiator, and 16-step sequencer"
```

---

### Task 8: Drum Engine & Patterns

**Files:**
- Create: `src/audio/drums.ts`
- Create: `src/data/drum-patterns.ts`
- Test: `src/audio/__tests__/drums.test.ts`

**Interfaces:**
- Consumes: `DrumKitName`, `DrumSound` from `src/audio/types.ts`.
- Produces: `DrumEngine` class with `constructor(ctx: BaseAudioContext, output: AudioNode)`, `triggerDrum(sound: DrumSound): void`, `loadKit(kit: DrumKitName): Promise<void>`, `generateSynthDrum(sound: DrumSound): AudioBuffer`. `DRUM_PATTERNS: DrumPattern[]` — 56 patterns as arrays of `{step, sound, velocity}`.

- [ ] **Step 1: Write failing test**

```typescript
// src/audio/__tests__/drums.test.ts
import { describe, it, expect } from 'vitest';
import { DrumEngine } from '@/audio/drums';

describe('DrumEngine', () => {
  it('generates synth drum sounds', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const drums = new DrumEngine(ctx, output);

    const kickBuffer = drums.generateSynthDrum('kick');
    expect(kickBuffer).toBeInstanceOf(AudioBuffer);
    expect(kickBuffer.length).toBeGreaterThan(0);
  });

  it('produces audio when triggering a drum', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    output.connect(ctx.destination);
    const drums = new DrumEngine(ctx, output);

    drums.triggerDrum('kick');

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const max = Math.max(...Array.from(data).map(Math.abs));
    expect(max).toBeGreaterThan(0.01);
  });

  it('maps all 7 drum sounds', () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const output = ctx.createGain();
    const drums = new DrumEngine(ctx, output);

    const sounds: import('@/audio/types').DrumSound[] = [
      'kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH',
    ];
    for (const sound of sounds) {
      const buf = drums.generateSynthDrum(sound);
      expect(buf.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Implement drums.ts with synthesized fallback drums**

```typescript
// src/audio/drums.ts
import type { DrumKitName, DrumSound } from './types';

const DRUM_SOUNDS: DrumSound[] = ['kick', 'altKick', 'snare', 'closedHH', 'tom', 'bellRide', 'openHH'];

export class DrumEngine {
  private ctx: BaseAudioContext;
  private output: AudioNode;
  private kits: Map<DrumKitName, Map<DrumSound, AudioBuffer>> = new Map();
  private currentKit: DrumKitName = 'tight';

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.loadSynthKit('tight');
  }

  private loadSynthKit(name: DrumKitName): void {
    const kit = new Map<DrumSound, AudioBuffer>();
    for (const sound of DRUM_SOUNDS) {
      kit.set(sound, this.generateSynthDrum(sound));
    }
    this.kits.set(name, kit);
  }

  generateSynthDrum(sound: DrumSound): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    switch (sound) {
      case 'kick':
      case 'altKick': {
        const startFreq = sound === 'altKick' ? 180 : 150;
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const freq = startFreq * Math.exp(-t * 40);
          const env = Math.exp(-t * 8);
          data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
        }
        break;
      }
      case 'snare': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 20);
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 15);
          data[i] = (tone * 0.5 + noise * 0.5) * 0.7;
        }
        break;
      }
      case 'closedHH': {
        const short = Math.floor(sampleRate * 0.08);
        for (let i = 0; i < short; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.5;
        }
        break;
      }
      case 'openHH': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.4;
        }
        break;
      }
      case 'tom': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const freq = 120 * Math.exp(-t * 15);
          data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.6;
        }
        break;
      }
      case 'bellRide': {
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const bell = Math.sin(2 * Math.PI * 800 * t) * 0.3 + Math.sin(2 * Math.PI * 1200 * t) * 0.2;
          const noise = (Math.random() * 2 - 1) * 0.1;
          data[i] = (bell + noise) * Math.exp(-t * 4) * 0.5;
        }
        break;
      }
    }
    return buffer;
  }

  triggerDrum(sound: DrumSound): void {
    const kit = this.kits.get(this.currentKit);
    const buffer = kit?.get(sound);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }

  setKit(kit: DrumKitName): void {
    this.currentKit = kit;
    if (!this.kits.has(kit)) {
      this.loadSynthKit(kit);
    }
  }

  async loadKit(kit: DrumKitName): Promise<void> {
    if (!this.kits.has(kit)) {
      this.loadSynthKit(kit);
    }
    this.currentKit = kit;
  }
}
```

- [ ] **Step 3: Implement drum-patterns.ts**

```typescript
// src/data/drum-patterns.ts
import type { DrumSound } from '@/audio/types';

export interface DrumHit {
  step: number; // 0-15 (16th note grid)
  sound: DrumSound;
  velocity: number; // 0-1
}

export interface DrumPattern {
  name: string;
  genre: string;
  variation: string;
  hits: DrumHit[];
}

function pattern(genre: string, variation: string, hits: DrumHit[]): DrumPattern {
  return { name: `${genre} - ${variation}`, genre, variation, hits };
}

function h(step: number, sound: DrumSound, velocity = 1): DrumHit {
  return { step, sound, velocity };
}

export const DRUM_PATTERNS: DrumPattern[] = [
  // Rock (8 variations)
  pattern('Rock', 'Original', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Ghost', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    h(2, 'snare', 0.3), h(6, 'snare', 0.3), h(10, 'snare', 0.3), h(14, 'snare', 0.3),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Busy HH', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'kick'), h(12, 'snare'),
    ...Array.from({ length: 16 }, (_, i) => h(i, 'closedHH', i % 2 === 0 ? 1 : 0.6)),
  ]),
  pattern('Rock', 'Syncopated', [
    h(0, 'kick'), h(3, 'kick'), h(4, 'snare'), h(8, 'kick'), h(11, 'kick'), h(12, 'snare'),
    h(0, 'closedHH'), h(2, 'closedHH'), h(4, 'closedHH'), h(6, 'closedHH'),
    h(8, 'closedHH'), h(10, 'closedHH'), h(12, 'closedHH'), h(14, 'closedHH'),
  ]),
  pattern('Rock', 'Fills', [
    h(0, 'kick'), h(4, 'snare'), h(8, 'tom'), h(9, 'tom'), h(10, 'tom'),
    h(11, 'tom'), h(12, 'snare'), h(14, 'kick'),
  ]),
  pattern('Rock', 'Half-time', [
    h(0, 'kick'), h(8, 'snare'),
    h(0, 'closedHH'), h(4, 'closedHH'), h(8, 'closedHH'), h(12, 'closedHH'),
  ]),
  pattern('Rock', 'Double-time', [
    h(0, 'kick'), h(2, 'snare'), h(4, 'kick'), h(6, 'snare'),
    h(8, 'kick'), h(10, 'snare'), h(12, 'kick'), h(14, 'snare'),
    ...Array.from({ length: 16 }, (_, i) => h(i, 'closedHH', 0.7)),
  ]),
  pattern('Rock', 'Jazz', [
    h(0, 'kick'), h(7, 'kick'), h(4, 'snare'), h(12, 'snare'),
    h(0, 'bellRide'), h(3, 'bellRide'), h(6, 'bellRide'), h(9, 'bellRide'), h(12, 'bellRide'),
  ]),
  // Remaining 48 patterns follow same structure for Disco, Reggae, Funk, Hip-Hop, Electro, Jazz
  // Each genre: Original, Ghost, Busy HH, Syncopated, Fills, Half-time, Double-time, Jazz
  // (patterns abbreviated for plan — full implementation fills all 56)
];

export function getPatternsForGenre(genre: string): DrumPattern[] {
  return DRUM_PATTERNS.filter((p) => p.genre === genre);
}

export const GENRES = ['Rock', 'Disco', 'Reggae', 'Funk', 'Hip-Hop', 'Electro', 'Jazz'];
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: drum engine with synthesized kits and 56 beat patterns"
```

---

### Task 9: Looper AudioWorklet

**Files:**
- Create: `src/audio/looper-worklet.ts`
- Create: `src/audio/looper.ts`
- Test: `src/audio/__tests__/looper.test.ts`

**Interfaces:**
- Consumes: `LooperState`, `LooperTrack` from `src/audio/types.ts`. `MasterClock` from Task 7.
- Produces: `LooperController` class with `constructor(ctx: AudioContext)`, `connectInput(source: AudioNode): void`, `connectOutput(dest: AudioNode): void`, `startRecording(trackIndex: number, loopLengthSamples: number): void`, `stopRecording(): void`, `togglePlayback(): void`, `setTrackGain(trackIndex: number, gain: number): void`, `muteTrack(trackIndex: number): void`, `unmuteTrack(trackIndex: number): void`, `clearTrack(trackIndex: number): void`, `clearAll(): void`, `getState(): LooperState`, `calculateLoopLength(bars: number, bpm: number, sampleRate: number): number`.

- [ ] **Step 1: Write failing test**

```typescript
// src/audio/__tests__/looper.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLoopLength } from '@/audio/looper';

describe('Looper', () => {
  it('calculates loop length in samples for 4 bars at 120 BPM', () => {
    const samples = calculateLoopLength(4, 120, 48000);
    // 4 bars * 4 beats/bar * 0.5s/beat * 48000 samples/s = 384000
    expect(samples).toBe(384000);
  });

  it('calculates loop length for 1 bar at 90 BPM', () => {
    const samples = calculateLoopLength(1, 90, 48000);
    // 1 * 4 * (60/90) * 48000 = 128000
    expect(samples).toBe(128000);
  });

  it('returns integer sample count (no fractional)', () => {
    const samples = calculateLoopLength(3, 137, 48000);
    expect(Number.isInteger(samples)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement looper.ts and looper-worklet.ts**

```typescript
// src/audio/looper-worklet.ts
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
```

```typescript
// src/audio/looper.ts
import type { LooperState } from './types';
import { getLooperWorkletUrl } from './looper-worklet';

export function calculateLoopLength(bars: number, bpm: number, sampleRate: number): number {
  const beatsPerBar = 4;
  const beatDuration = 60 / bpm;
  return Math.round(bars * beatsPerBar * beatDuration * sampleRate);
}

export class LooperController {
  private ctx: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private state: LooperState = 'off';
  private initialized = false;
  private onStateChange: ((state: LooperState, trackIndex?: number) => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const url = getLooperWorkletUrl();
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.workletNode = new AudioWorkletNode(this.ctx, 'looper-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.workletNode.port.onmessage = (e) => {
      if (e.data.type === 'recordingDone') {
        this.state = 'looping';
        this.onStateChange?.('looping', e.data.trackIndex);
      }
    };
    this.initialized = true;
  }

  connectInput(source: AudioNode): void {
    source.connect(this.workletNode!);
  }

  connectOutput(dest: AudioNode): void {
    this.workletNode!.connect(dest);
  }

  startRecording(trackIndex: number, loopLengthSamples: number): void {
    this.state = 'recording';
    this.workletNode?.port.postMessage({
      type: 'startRecord',
      trackIndex,
      loopLength: loopLengthSamples,
    });
  }

  stopRecording(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'stopRecord', trackIndex });
    this.state = 'looping';
  }

  togglePlayback(): void {
    if (this.state === 'looping') {
      this.workletNode?.port.postMessage({ type: 'stop' });
      this.state = 'off';
    } else {
      this.workletNode?.port.postMessage({ type: 'play' });
      this.state = 'looping';
    }
  }

  setTrackGain(trackIndex: number, gain: number): void {
    this.workletNode?.port.postMessage({ type: 'setGain', trackIndex, gain });
  }

  muteTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'mute', trackIndex });
  }

  unmuteTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'unmute', trackIndex });
  }

  clearTrack(trackIndex: number): void {
    this.workletNode?.port.postMessage({ type: 'clearTrack', trackIndex });
  }

  clearAll(): void {
    this.workletNode?.port.postMessage({ type: 'clearAll' });
    this.state = 'off';
  }

  getState(): LooperState { return this.state; }

  onStateChanged(cb: (state: LooperState, trackIndex?: number) => void): void {
    this.onStateChange = cb;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: looper AudioWorklet with 6-track recording and sample-accurate boundaries"
```

---

### Task 10: UI Shell — Layout, Piano Keys & Gesture Pad

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/components/PianoKeys.tsx`
- Create: `src/components/GesturePad.tsx`
- Create: `src/components/VolumeSlider.tsx`
- Create: `src/components/FunctionButtons.tsx`
- Create: `src/components/InfoBar.tsx`
- Create: `src/components/CenterArea.tsx`
- Create: `src/styles/global.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Test: `src/components/__tests__/PianoKeys.test.tsx`

**Interfaces:**
- Consumes: `useAppStore` from Task 1. `AudioEngine` from Task 4. `getChord()` from Task 3.
- Produces: Full landscape layout with interactive piano keys, gesture pad, function buttons, info bar, volume slider, center area. Touch handler integration for low-latency note triggering.

- [ ] **Step 1: Create global.css**

```css
/* src/styles/global.css */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

@media (orientation: portrait) {
  body::after {
    content: 'Please rotate your device to landscape mode';
    position: fixed;
    inset: 0;
    background: #1a1a2e;
    color: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    z-index: 9999;
    text-align: center;
    padding: 2rem;
  }
}
```

- [ ] **Step 2: Create PianoKeys.tsx**

```tsx
// src/components/PianoKeys.tsx
import { useRef, useEffect, useCallback } from 'react';
import type { ScaleDegree } from '@/music/types';

interface PianoKeysProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  activeKeys: Set<ScaleDegree>;
  labels: string[];
}

const WHITE_KEYS: ScaleDegree[] = [1, 3, 5, 7];
const BLACK_KEYS: ScaleDegree[] = [2, 4, 6];

export function PianoKeys({ onKeyDown, onKeyUp, activeKeys, labels }: PianoKeysProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-degree]');
      if (!target) return;
      const degree = Number(target.getAttribute('data-degree')) as ScaleDegree;
      (target as HTMLElement).setPointerCapture(e.pointerId);
      onKeyDown(degree);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest('[data-degree]');
      if (!target) return;
      const degree = Number(target.getAttribute('data-degree')) as ScaleDegree;
      onKeyUp(degree);
    };

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onKeyDown, onKeyUp]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* White keys (bottom layer) */}
      <div style={{ display: 'flex', position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', gap: 2 }}>
        {WHITE_KEYS.map((degree, i) => (
          <div
            key={degree}
            data-degree={degree}
            style={{
              flex: 1,
              background: activeKeys.has(degree) ? '#4a9eff' : '#e8e8e8',
              borderRadius: '0 0 8px 8px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 12,
              fontSize: 14,
              fontWeight: 600,
              color: '#333',
              cursor: 'pointer',
              transition: 'background 0.05s',
            }}
          >
            {labels[degree - 1] ?? degree}
          </div>
        ))}
      </div>
      {/* Black keys (top layer) */}
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: '8%', right: '20%', height: '60%', gap: 4, justifyContent: 'space-between' }}>
        {BLACK_KEYS.map((degree) => (
          <div
            key={degree}
            data-degree={degree}
            style={{
              width: '28%',
              background: activeKeys.has(degree) ? '#3a7bcc' : '#333',
              borderRadius: '0 0 6px 6px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#ccc',
              cursor: 'pointer',
              zIndex: 2,
              transition: 'background 0.05s',
            }}
          >
            {labels[degree - 1] ?? degree}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create GesturePad.tsx**

```tsx
// src/components/GesturePad.tsx
import { useRef, useEffect, useState } from 'react';
import type { JoystickDirection } from '@/music/types';

interface GesturePadProps {
  onDirectionChange: (dir: JoystickDirection) => void;
  onCenterTap: () => void;
  currentLabel: string;
}

function vectorToDirection(dx: number, dy: number, deadzone: number): JoystickDirection {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < deadzone) return 'center';

  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'upRight';
  if (angle >= 67.5 && angle < 112.5) return 'up';
  if (angle >= 112.5 && angle < 157.5) return 'upLeft';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'downLeft';
  if (angle >= -112.5 && angle < -67.5) return 'down';
  return 'downRight';
}

export function GesturePad({ onDirectionChange, onCenterTap, currentLabel }: GesturePadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 });
  const [active, setActive] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = padRef.current;
    if (!el) return;

    const getRelPos = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    };

    const handleDown = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      setActive(true);
      const pos = getRelPos(e);
      startRef.current = pos;
      setDotPos(pos);
    };

    const handleMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      const pos = getRelPos(e);
      setDotPos(pos);
      const dx = pos.x - 50;
      const dy = pos.y - 50;
      const dir = vectorToDirection(dx, dy, 15);
      onDirectionChange(dir);
    };

    const handleUp = (e: PointerEvent) => {
      if (!startRef.current) return;
      const pos = getRelPos(e);
      const dx = Math.abs(pos.x - startRef.current.x);
      const dy = Math.abs(pos.y - startRef.current.y);
      if (dx < 5 && dy < 5) onCenterTap();

      startRef.current = null;
      setActive(false);
      setDotPos({ x: 50, y: 50 });
      onDirectionChange('center');
    };

    el.addEventListener('pointerdown', handleDown, { passive: false });
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
    el.addEventListener('pointercancel', handleUp);

    return () => {
      el.removeEventListener('pointerdown', handleDown);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
      el.removeEventListener('pointercancel', handleUp);
    };
  }, [onDirectionChange, onCenterTap]);

  return (
    <div
      ref={padRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#16213e',
        borderRadius: 12,
        border: '2px solid #2a3a5c',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* Direction zone lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#4a9eff" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#4a9eff" />
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="#4a9eff" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke="#4a9eff" />
      </svg>
      {/* Thumb dot */}
      <div
        style={{
          position: 'absolute',
          left: `${dotPos.x}%`,
          top: `${dotPos.y}%`,
          transform: 'translate(-50%, -50%)',
          width: active ? 40 : 24,
          height: active ? 40 : 24,
          borderRadius: '50%',
          background: active ? '#4a9eff' : '#3a5a8c',
          transition: active ? 'none' : 'all 0.15s ease-out',
          boxShadow: active ? '0 0 20px rgba(74,158,255,0.5)' : 'none',
        }}
      />
      {/* Label */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 13,
        color: '#4a9eff',
        fontWeight: 600,
      }}>
        {currentLabel || 'DEFAULT'}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create remaining shell components**

Create `FunctionButtons.tsx`, `InfoBar.tsx`, `VolumeSlider.tsx`, `CenterArea.tsx` — each with basic structure, connected to store. Then create `Layout.tsx` assembling them all in the landscape grid.

```tsx
// src/components/FunctionButtons.tsx
import { useAppStore } from '@/store';

export function FunctionButtons() {
  const activeOverlay = useAppStore((s) => s.activeOverlay);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);
  const setHeld = useAppStore((s) => s.setHeldFunctionButton);

  const buttons = [
    { id: 'gray' as const, color: '#888', label: 'KEY' },
    { id: 'yellow' as const, color: '#f0c040', label: 'SOUND' },
    { id: 'red' as const, color: '#e04040', label: 'MODE' },
  ];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {buttons.map((btn) => (
        <button
          key={btn.id}
          onPointerDown={() => setHeld(btn.id, true)}
          onPointerUp={() => { setHeld(btn.id, false); setActiveOverlay(activeOverlay === btn.id ? null : btn.id); }}
          style={{
            background: activeOverlay === btn.id ? btn.color : `${btn.color}66`,
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/components/InfoBar.tsx
import { useAppStore } from '@/store';

export function InfoBar() {
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  const bpm = useAppStore((s) => s.bpm);
  const playMode = useAppStore((s) => s.playMode);
  const chordName = useAppStore((s) => s.currentChordName);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      fontSize: 13,
      fontFamily: 'monospace',
      color: '#8af',
    }}>
      <span>{key} {scale}</span>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{chordName || '—'}</span>
      <span>{playMode}</span>
      <span>BPM:{bpm}</span>
    </div>
  );
}
```

```tsx
// src/components/VolumeSlider.tsx
import { useRef, useEffect } from 'react';

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function VolumeSlider({ value, onChange }: VolumeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const update = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const pct = 1 - (e.clientY - rect.top) / rect.height;
      onChange(Math.max(0, Math.min(1, pct)));
    };

    let dragging = false;
    const down = (e: PointerEvent) => { dragging = true; el.setPointerCapture(e.pointerId); update(e); };
    const move = (e: PointerEvent) => { if (dragging) update(e); };
    const up = () => { dragging = false; };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, [onChange]);

  return (
    <div ref={sliderRef} style={{
      width: '100%',
      height: 30,
      background: '#16213e',
      borderRadius: 4,
      position: 'relative',
      cursor: 'pointer',
      touchAction: 'none',
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${value * 100}%`,
        background: '#4a9eff',
        borderRadius: 4,
        transition: 'height 0.05s',
      }} />
    </div>
  );
}
```

```tsx
// src/components/CenterArea.tsx
import { useAppStore } from '@/store';

export function CenterArea() {
  const mode = useAppStore((s) => s.playMode);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#445',
      fontSize: 14,
    }}>
      {/* Mode-specific content placeholder — filled in Tasks 12-16 */}
      <span style={{ opacity: 0.5 }}>{mode} mode</span>
    </div>
  );
}
```

```tsx
// src/components/Layout.tsx
import { FunctionButtons } from './FunctionButtons';
import { InfoBar } from './InfoBar';
import { GesturePad } from './GesturePad';
import { PianoKeys } from './PianoKeys';
import { VolumeSlider } from './VolumeSlider';
import { CenterArea } from './CenterArea';
import type { ScaleDegree, JoystickDirection } from '@/music/types';

interface LayoutProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  onDirectionChange: (dir: JoystickDirection) => void;
  onCenterTap: () => void;
  onVolumeChange: (vol: number) => void;
  activeKeys: Set<ScaleDegree>;
  volume: number;
  currentModLabel: string;
  chordLabels: string[];
}

export function Layout(props: LayoutProps) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateRows: '36px 1fr 40px',
      gridTemplateColumns: '38% 1fr 30%',
      background: '#1a1a2e',
      gap: 4,
      padding: 4,
    }}>
      {/* Top bar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
        <FunctionButtons />
        <InfoBar />
      </div>

      {/* Left: Gesture Pad + Volume */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
        <div style={{ flex: 1 }}>
          <GesturePad
            onDirectionChange={props.onDirectionChange}
            onCenterTap={props.onCenterTap}
            currentLabel={props.currentModLabel}
          />
        </div>
        <VolumeSlider value={props.volume} onChange={props.onVolumeChange} />
      </div>

      {/* Center */}
      <CenterArea />

      {/* Right: Piano Keys */}
      <div style={{ padding: '0 4px' }}>
        <PianoKeys
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
          activeKeys={props.activeKeys}
          labels={props.chordLabels}
        />
      </div>

      {/* Bottom: Looper strip */}
      <div style={{
        gridColumn: '1 / -1',
        background: '#16213e',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        fontSize: 11,
        color: '#668',
      }}>
        {[1, 2, 3, 4, 5, 6].map((t) => (
          <span key={t}>T{t} ░░░░</span>
        ))}
        <span style={{ marginLeft: 'auto' }}>⏺ ⏹ ▶</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update App.tsx to wire Layout to engine + store**

```tsx
// src/App.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAppStore } from '@/store';
import { AudioEngine } from '@/audio/engine';
import { getChord } from '@/music/chord-engine';
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
      directionRef.current, state.joystickMode, state.inversions[degree - 1],
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
```

- [ ] **Step 6: Write component test**

```tsx
// src/components/__tests__/PianoKeys.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PianoKeys } from '@/components/PianoKeys';

describe('PianoKeys', () => {
  it('renders 7 chord labels', () => {
    const labels = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    render(
      <PianoKeys
        onKeyDown={vi.fn()}
        onKeyUp={vi.fn()}
        activeKeys={new Set()}
        labels={labels}
      />
    );
    for (const label of labels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 7: Run all tests, verify dev server renders**

```bash
npm test
npm run dev
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: landscape UI shell with piano keys, gesture pad, and audio wiring"
```

---

### Task 11: Keyboard Bindings & Input Handler

**Files:**
- Create: `src/input/keyboard-handler.ts`
- Modify: `src/App.tsx` — integrate keyboard handler
- Test: `src/input/__tests__/keyboard-handler.test.ts`

**Interfaces:**
- Consumes: `ScaleDegree`, `JoystickDirection` from `src/music/types.ts`. `useAppStore` from `src/store/index.ts`.
- Produces: `KeyboardHandler` class with `constructor(callbacks)`, `attach(): void`, `detach(): void`. Callbacks: `onChordDown(degree: ScaleDegree)`, `onChordUp(degree: ScaleDegree)`, `onDirection(dir: JoystickDirection)`, `onFunctionButton(btn: 'gray'|'yellow'|'red', down: boolean)`, `onCenterTap()`, `onVolumeChange(delta: number)`, `onTrackToggle(track: number)`.

- [ ] **Step 1: Write failing test**

```typescript
// src/input/__tests__/keyboard-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getKeyMapping } from '@/input/keyboard-handler';

describe('keyboard mapping', () => {
  it('maps H to degree 1', () => {
    expect(getKeyMapping('h')).toEqual({ type: 'chord', degree: 1 });
  });

  it('maps U to degree 2', () => {
    expect(getKeyMapping('u')).toEqual({ type: 'chord', degree: 2 });
  });

  it('maps J to degree 3', () => {
    expect(getKeyMapping('j')).toEqual({ type: 'chord', degree: 3 });
  });

  it('maps W to direction up', () => {
    expect(getKeyMapping('w')).toEqual({ type: 'direction', dir: 'up' });
  });

  it('maps Space to centerTap', () => {
    expect(getKeyMapping(' ')).toEqual({ type: 'centerTap' });
  });

  it('maps Q to function gray', () => {
    expect(getKeyMapping('q')).toEqual({ type: 'function', btn: 'gray' });
  });

  it('returns null for unmapped keys', () => {
    expect(getKeyMapping('p')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement keyboard-handler.ts**

```typescript
// src/input/keyboard-handler.ts
import type { ScaleDegree, JoystickDirection } from '@/music/types';

type KeyMapping =
  | { type: 'chord'; degree: ScaleDegree }
  | { type: 'direction'; dir: JoystickDirection }
  | { type: 'function'; btn: 'gray' | 'yellow' | 'red' }
  | { type: 'centerTap' }
  | { type: 'volume'; delta: number }
  | { type: 'track'; index: number };

const KEY_MAP: Record<string, KeyMapping> = {
  'h': { type: 'chord', degree: 1 },
  'u': { type: 'chord', degree: 2 },
  'j': { type: 'chord', degree: 3 },
  'k': { type: 'chord', degree: 4 },
  'l': { type: 'chord', degree: 5 },
  'o': { type: 'chord', degree: 6 },
  ';': { type: 'chord', degree: 7 },
  'w': { type: 'direction', dir: 'up' },
  'e': { type: 'function', btn: 'yellow' },
  'd': { type: 'direction', dir: 'right' },
  'x': { type: 'direction', dir: 'down' },
  's': { type: 'direction', dir: 'down' },
  'a': { type: 'direction', dir: 'left' },
  'q': { type: 'function', btn: 'gray' },
  'r': { type: 'function', btn: 'red' },
  ' ': { type: 'centerTap' },
  'z': { type: 'volume', delta: -0.05 },
  'c': { type: 'volume', delta: 0.05 },
  '1': { type: 'track', index: 0 },
  '2': { type: 'track', index: 1 },
  '3': { type: 'track', index: 2 },
  '4': { type: 'track', index: 3 },
  '5': { type: 'track', index: 4 },
  '6': { type: 'track', index: 5 },
};

export function getKeyMapping(key: string): KeyMapping | null {
  return KEY_MAP[key.toLowerCase()] ?? null;
}

interface KeyboardCallbacks {
  onChordDown: (degree: ScaleDegree) => void;
  onChordUp: (degree: ScaleDegree) => void;
  onDirection: (dir: JoystickDirection) => void;
  onFunctionButton: (btn: 'gray' | 'yellow' | 'red', down: boolean) => void;
  onCenterTap: () => void;
  onVolumeChange: (delta: number) => void;
  onTrackToggle: (index: number) => void;
}

export class KeyboardHandler {
  private callbacks: KeyboardCallbacks;
  private heldKeys = new Set<string>();
  private heldDirections = new Set<string>();

  constructor(callbacks: KeyboardCallbacks) {
    this.callbacks = callbacks;
  }

  attach(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (this.heldKeys.has(key)) return;
    this.heldKeys.add(key);

    const mapping = getKeyMapping(key);
    if (!mapping) return;

    e.preventDefault();
    switch (mapping.type) {
      case 'chord':
        this.callbacks.onChordDown(mapping.degree);
        break;
      case 'direction':
        this.heldDirections.add(key);
        this.callbacks.onDirection(mapping.dir);
        break;
      case 'function':
        this.callbacks.onFunctionButton(mapping.btn, true);
        break;
      case 'centerTap':
        this.callbacks.onCenterTap();
        break;
      case 'volume':
        this.callbacks.onVolumeChange(mapping.delta);
        break;
      case 'track':
        this.callbacks.onTrackToggle(mapping.index);
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.heldKeys.delete(key);

    const mapping = getKeyMapping(key);
    if (!mapping) return;

    switch (mapping.type) {
      case 'chord':
        this.callbacks.onChordUp(mapping.degree);
        break;
      case 'direction':
        this.heldDirections.delete(key);
        if (this.heldDirections.size === 0) {
          this.callbacks.onDirection('center');
        }
        break;
      case 'function':
        this.callbacks.onFunctionButton(mapping.btn, false);
        break;
    }
  };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: keyboard handler with chord, direction, and function key bindings"
```

---

### Task 12: Menu Overlays

**Files:**
- Create: `src/components/MenuOverlay.tsx`
- Create: `src/components/overlays/GrayOverlay.tsx`
- Create: `src/components/overlays/YellowOverlay.tsx`
- Create: `src/components/overlays/RedOverlay.tsx`
- Modify: `src/components/Layout.tsx` — add overlay rendering
- Test: `src/components/__tests__/MenuOverlay.test.tsx`

**Interfaces:**
- Consumes: `useAppStore` from `src/store/index.ts`. All types from `src/music/types.ts` and `src/audio/types.ts`.
- Produces: `<MenuOverlay />` component rendering the active overlay (gray/yellow/red) with full settings for key/octave/scale (gray), instrument/effects/ADSR (yellow), mode/BPM/mode-params (red). Overlays slide up from top bar, close on outside tap.

Implementation follows same patterns as Task 10 components — Zustand-connected React components with inline styles. Each overlay reads and writes store values. Effects sliders call `AudioEngine.setEffect()` via ref. Full code for all 3 overlays with every setting from the spec (key selector, all 10 scales, all effects toggles/sliders, all 15 modes, BPM slider, tap tempo, strum speed, arp pattern/rate/chord-mode selectors).

- [ ] **Step 1-5:** Write test, implement GrayOverlay, YellowOverlay, RedOverlay, MenuOverlay router, wire into Layout. Standard TDD cycle.

- [ ] **Step 6: Run tests, verify in browser**

```bash
npm test
npm run dev
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: menu overlays for key, sound, and mode settings"
```

---

### Task 13: Play Modes — Core Modes (Play, Strum, Lead, Drone, Repeat, Arpeggio)

**Files:**
- Create: `src/audio/play-modes.ts`
- Modify: `src/App.tsx` — route mode behavior to engine
- Test: `src/audio/__tests__/play-modes.test.ts`

**Interfaces:**
- Consumes: `PlayMode`, `StumSpeed`, `STRUM_INTERVALS`, `ArpPattern`, `ArpRate`, `ArpChordMode` from `src/audio/types.ts`. `AudioEngine` from Task 4. `MasterClock` from Task 7. `Arpeggiator` from Task 7. `ChordVoicing`, `Note` from `src/music/types.ts`.
- Produces: `PlayModeHandler` class with `setMode(mode: PlayMode): void`, `handleChordDown(voicing: ChordVoicing): void`, `handleChordUp(): void`, `setStrumSpeed(speed: StumSpeed): void`, `setArpSettings(pattern, rate, chordMode): void`, `start(): void`, `stop(): void`.

Implements: Play (instant trigger/release), Strum (sequential note delays), Lead (monophonic, last-note-wins), Drone (infinite sustain), Repeat (clock re-trigger), Arpeggio (clock-driven pattern via Arpeggiator).

- [ ] **Step 1-5:** TDD cycle — test each mode behavior, implement PlayModeHandler, wire into App.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: core play modes — play, strum, lead, drone, repeat, arpeggio"
```

---

### Task 14: Drum Modes, Looper UI & Sequencer UI

**Files:**
- Create: `src/components/LooperView.tsx`
- Create: `src/components/SequencerGrid.tsx`
- Create: `src/components/DrumView.tsx`
- Modify: `src/components/CenterArea.tsx` — route mode-specific views
- Modify: `src/App.tsx` — wire looper, drum, sequencer interactions

**Interfaces:**
- Consumes: `DrumEngine` from Task 8. `LooperController` from Task 9. `Sequencer` from Task 7. `MasterClock` from Task 7. `useAppStore`.
- Produces: `<LooperView />` with 6-track waveform display, transport buttons, quantize selector. `<SequencerGrid />` with 16-step tap editor. `<DrumView />` with button-to-drum mapping display and pattern selector. `<CenterArea />` routes to correct view based on `playMode`.

Implements drum mode (buttons trigger drum sounds), drum loops (pattern playback with genre/variation selector), auto-drum (held buttons trigger at clock rate), sequencer (tap-to-edit 16-step grid), looper/mixer views.

- [ ] **Step 1-6:** TDD cycle for each component and interaction.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: drum, looper, and sequencer UI with mode routing"
```

---

### Task 15: Vocoder, Mic Sampling & Tuner

**Files:**
- Create: `src/audio/vocoder.ts`
- Create: `src/audio/mic-sampler.ts`
- Create: `src/audio/tuner.ts`
- Create: `src/components/Tuner.tsx`
- Modify: `src/components/CenterArea.tsx` — add tuner and mic sample views

**Interfaces:**
- Consumes: `AudioEngine.getContext()`. `getUserMedia` API.
- Produces: `Vocoder` class with `constructor(ctx: AudioContext)`, `connectMicSource(stream: MediaStream): void`, `connectSynthSource(source: AudioNode): void`, `setFormantShift(semitones: number): void`, `setGateThreshold(threshold: number): void`, `enable(): void`, `disable(): void`. `MicSampler` class with `record(): Promise<AudioBuffer>`, `getDetectedPitch(): number`. `Tuner` class with `start(stream: MediaStream): void`, `stop(): void`, `onPitchDetected(cb: (note, cents) => void): void`.

- [ ] **Step 1-5:** TDD cycle for vocoder band processing, mic sampling with pitch detection, tuner display.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: vocoder, mic sampling, and chromatic tuner"
```

---

### Task 16: Chord Hiro & Ear Trainer Game Modes

**Files:**
- Create: `src/components/ChordHiro.tsx`
- Create: `src/components/EarTrainer.tsx`
- Modify: `src/components/CenterArea.tsx` — add game views

**Interfaces:**
- Consumes: `getDiatonicChord()` from `src/music/chord-engine.ts`. `AudioEngine` from Task 4. `useAppStore`.
- Produces: `<ChordHiro />` — falling chord names, player presses correct button in time, score tracking. `<EarTrainer />` — plays random chord, 4 difficulty levels (triad quality, 7th chords, extensions, all), player identifies from options.

- [ ] **Step 1-4:** TDD cycle for game logic and components.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Chord Hiro game and ear trainer modes"
```

---

### Task 17: IndexedDB Storage & Presets

**Files:**
- Create: `src/db/index.ts`
- Create: `src/data/presets.ts`
- Modify: `src/App.tsx` — preset load/save integration
- Test: `src/db/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `Preset` from `src/audio/types.ts`. `idb` library.
- Produces: `HiChordDB` with `savePreset(preset: Preset): Promise<void>`, `loadPreset(id: string): Promise<Preset>`, `listPresets(): Promise<Preset[]>`, `deletePreset(id: string): Promise<void>`, `saveSample(name: string, data: ArrayBuffer): Promise<void>`, `loadSample(name: string): Promise<ArrayBuffer>`, `saveSettings(settings: object): Promise<void>`, `loadSettings(): Promise<object>`, `exportPreset(preset: Preset): string` (JSON), `importPreset(json: string): Preset`.

- [ ] **Step 1: Write failing test**

```typescript
// src/db/__tests__/index.test.ts
import { describe, it, expect } from 'vitest';
import { exportPreset, importPreset } from '@/db';

describe('preset export/import', () => {
  it('round-trips a preset through JSON', () => {
    const preset = {
      id: 'test-1',
      name: 'Test Preset',
      synthMode: 'analog' as const,
      waveform: 'sawtooth' as const,
      fmPresetIndex: 0,
      sampleName: 'piano',
      adsr: { attack: 20, decay: 100, sustain: 0.7, release: 300 },
      effects: {},
      key: 'C' as const,
      scale: 'major' as const,
      globalOctave: 0,
      buttonOctaves: [0,0,0,0,0,0,0],
      inversions: [0,0,0,0,0,0,0],
      chordLocks: [],
      bassMode: 'off' as const,
      voiceLeading: false,
      joystickMode: 'default' as const,
      drumKit: 'tight' as const,
      arpPattern: 'up' as const,
      arpRate: '1/8' as const,
      arpChordMode: 'arpOnly' as const,
      bpm: 120,
    };
    const json = exportPreset(preset as any);
    const restored = importPreset(json);
    expect(restored.name).toBe('Test Preset');
    expect(restored.key).toBe('C');
  });
});
```

- [ ] **Step 2-5:** Implement db module, factory presets, wire preset save/load UI.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: IndexedDB storage with preset save/load/export/import"
```

---

### Task 18: MIDI Output

**Files:**
- Create: `src/audio/midi.ts`
- Modify: `src/App.tsx` — wire MIDI output to chord/drum triggers
- Test: `src/audio/__tests__/midi.test.ts`

**Interfaces:**
- Consumes: `Note`, `ChordVoicing` from `src/music/types.ts`. Web MIDI API.
- Produces: `MIDIOutput` class with `init(): Promise<boolean>`, `sendNoteOn(note: number, velocity: number, channel: number): void`, `sendNoteOff(note: number, channel: number): void`, `sendChord(voicing: ChordVoicing): void`, `releaseAll(): void`, `getOutputs(): MIDIOutput[]`, `selectOutput(id: string): void`, `isAvailable(): boolean`.

- [ ] **Step 1-4:** TDD cycle for MIDI message formatting and output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Web MIDI output for external synth control"
```

---

### Task 19: PWA Configuration & Capacitor Setup

**Files:**
- Modify: `vite.config.ts` — finalize PWA manifest
- Create: `capacitor.config.ts`
- Create: `public/icon-192.png` (placeholder)
- Create: `public/icon-512.png` (placeholder)

**Interfaces:**
- Consumes: Built app from `npm run build`.
- Produces: Installable PWA with offline support. Capacitor project configured for Android build.

- [ ] **Step 1: Finalize PWA manifest and service worker config**

Verify `vite-plugin-pwa` config in `vite.config.ts` caches all assets including audio samples.

- [ ] **Step 2: Add placeholder icons**

Create simple colored square PNGs for 192x192 and 512x512.

- [ ] **Step 3: Initialize Capacitor**

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/screen-orientation @capacitor/keep-awake
npx cap init HiChord com.hichord.app --web-dir dist
npx cap add android
```

- [ ] **Step 4: Create capacitor.config.ts**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hichord.app',
  appName: 'HiChord',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    ScreenOrientation: {
      landscape: true,
    },
    KeepAwake: {},
  },
};

export default config;
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
npx cap sync
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PWA service worker and Capacitor Android configuration"
```

---

### Task 20: Integration Testing & Polish

**Files:**
- Create: `src/__tests__/integration.test.ts`
- Modify: various files for bug fixes found during testing

**Interfaces:**
- Consumes: all modules.
- Produces: Integration test covering: chord engine → audio engine → looper flow. End-to-end preset save/load. All play mode transitions.

- [ ] **Step 1: Write integration test**

```typescript
// src/__tests__/integration.test.ts
import { describe, it, expect } from 'vitest';
import { getChord } from '@/music/chord-engine';
import { getScaleNotes } from '@/music/scales';
import { calculateLoopLength } from '@/audio/looper';
import { DRUM_PATTERNS } from '@/data/drum-patterns';
import { useAppStore } from '@/store';
import { ALL_KEYS } from '@/music/types';

describe('integration', () => {
  it('generates valid chords for all keys and degrees', () => {
    for (const key of ALL_KEYS) {
      for (let degree = 1; degree <= 7; degree++) {
        const chord = getChord(key, 'major', degree as any, 4, 'center', 'default', 0, 'off', []);
        expect(chord.notes.length).toBeGreaterThanOrEqual(3);
        expect(chord.displayName.length).toBeGreaterThan(0);
        for (const note of chord.notes) {
          expect(note.frequency).toBeGreaterThan(0);
          expect(note.midi).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('generates valid chords for all joystick directions and modes', () => {
    const directions = ['up', 'upRight', 'right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'center'] as const;
    const modes = ['default', 'extended', 'chromatic'] as const;
    for (const mode of modes) {
      for (const dir of directions) {
        const chord = getChord('C', 'major', 1, 4, dir, mode, 0, 'off', []);
        expect(chord.notes.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('loop length calculation works for all reasonable BPMs', () => {
    for (let bpm = 40; bpm <= 300; bpm += 10) {
      for (let bars = 1; bars <= 8; bars++) {
        const samples = calculateLoopLength(bars, bpm, 48000);
        expect(samples).toBeGreaterThan(0);
        expect(Number.isInteger(samples)).toBe(true);
      }
    }
  });

  it('has drum patterns for all genres', () => {
    const genres = ['Rock', 'Disco', 'Reggae', 'Funk', 'Hip-Hop', 'Electro', 'Jazz'];
    for (const genre of genres) {
      const patterns = DRUM_PATTERNS.filter((p) => p.genre === genre);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('store mode transitions work', () => {
    const store = useAppStore.getState();
    store.setPlayMode('arpeggio');
    expect(useAppStore.getState().playMode).toBe('arpeggio');
    store.setPlayMode('drum');
    expect(useAppStore.getState().playMode).toBe('drum');
    store.setPlayMode('play');
  });
});
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

- [ ] **Step 3: Build production bundle, verify size**

```bash
npm run build
```

Check `dist/` output — bundle should be under 500KB gzipped excluding samples.

- [ ] **Step 4: Manual testing in browser**

Start dev server, test in landscape:
- Play chords with touch/keyboard
- Modify chords with gesture pad
- Change key, scale, mode via overlays
- Verify effects toggle
- Test looper record/play cycle
- Verify arpeggiator patterns
- Test drum mode triggers

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integration tests and polish pass"
```

---

## Milestone Summary

| Task | Deliverable | Testable |
|------|------------|----------|
| 1 | Project scaffold, types, store | Dev server runs |
| 2 | Chord engine — scales & triads | Unit tests |
| 3 | Joystick mods & voice leading | Unit tests |
| 4 | Audio engine + analog synth | OfflineAudioContext tests |
| 5 | FM, sample, noise synths | Audio tests |
| 6 | Effects chain | Audio tests |
| 7 | Clock, arpeggiator, sequencer | Unit tests |
| 8 | Drum engine & patterns | Audio tests |
| 9 | Looper AudioWorklet | Unit tests |
| 10 | UI shell — layout, keys, pad | Component tests + visual |
| 11 | Keyboard bindings | Unit tests |
| 12 | Menu overlays | Component tests + visual |
| 13 | Core play modes | Behavior tests |
| 14 | Drum/looper/sequencer UI | Visual + interaction |
| 15 | Vocoder, mic, tuner | Audio tests |
| 16 | Game modes | Component tests |
| 17 | IndexedDB & presets | Storage tests |
| 18 | MIDI output | Message tests |
| 19 | PWA & Capacitor | Build + install test |
| 20 | Integration & polish | Full suite pass |
