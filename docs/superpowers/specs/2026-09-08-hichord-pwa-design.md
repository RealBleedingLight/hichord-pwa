# HiChord PWA — Design Specification

## Overview

Standalone software synthesizer PWA that recreates the full HiChord pocket synthesizer experience in a browser. Touch-optimized landscape mobile UI with keyboard bindings for laptop use. Packages as Android app via Capacitor. All data stored locally (IndexedDB). No backend, no accounts.

**Target:** Full feature parity with HiChord hardware (Batch 4+).

**Stack:** React + TypeScript, Vite, Zustand, Web Audio API, AudioWorklet, Capacitor.

---

## 1. Architecture

Five core modules, each independent:

### 1.1 Chord Engine (`src/music/`)

Pure math — zero audio dependencies. Takes `(key, scale, degree, joystickDirection, inversions, chordLocks)` and returns note arrays with frequencies.

- 84,000+ voicings: 12 keys × 28 chord types × 3 inversions × octaves × slash chords
- 10 scales: Major, Natural Minor, Harmonic Minor, Melodic Minor, Major Pentatonic, Minor Pentatonic, Blues, Dorian, Mixolydian, Lydian
- 7 diatonic degrees (I–vii°) mapped to buttons
- 3 joystick modes with 8 directions each:
  - **Default:** Aug, Maj↔Min, Dom7, Dim/Min, Maj7, 6th/Sus2, Sus4, 9th
  - **Extended:** Half-dim7, Dom7#9, Sus4+7, Add11, Dom9, Add9, Min11, Maj↔Min
  - **Chromatic:** Min(Maj7), Maj13, 6/9, Maj7#11, Dom13, Dom7b9, Dom7alt, Half-dim7
- Voice leading: auto-selects smoothest inversions between successive chords
- Chord lock: permanently save joystick modification to a button
- Slash chords: configurable bass note independent of chord voicing
- Per-button octave shift (−2 to +1)
- Global octave shift (−1 to +2)

Voice allocation (6 stereo pairs):

| Voice | Role |
|-------|------|
| 1 | Root note |
| 2 | Third |
| 3 | Fifth |
| 4 | Bass (when bass mode enabled) |
| 5 | Extension (7th, 9th, etc.) |
| 6 | Additional harmonic / doubling |

### 1.2 Audio Engine (`src/audio/`)

Single `AudioContext` instance. Contains synth voices, effects chain, mixer. Receives note arrays from Chord Engine, produces sound. Exposes parameter setters (not React state — direct refs for low-latency control).

**4 Synthesis Modes:**

1. **Analog** — 12 `OscillatorNode`s (6 stereo pairs). Waveforms: sine, sawtooth, square, triangle. Each pair panned L/R.

2. **FM** — 12 oscillators as carrier+modulator pairs. Each stereo pair = 1 carrier + 1 modulator. `OscillatorNode` → `GainNode` (mod depth) → carrier `.frequency` AudioParam. Presets for FM EPiano, HX7, Bell, Organ, Brass via modulation index and ratio parameters.

3. **Sample** — `AudioBufferSourceNode` per voice. 30+ preloaded instrument samples (piano, strings, flute, clarinet, saw, brass, pads, organs). Pitch shifting via `playbackRate` (±24 semitones).

4. **Noise** — `AudioWorklet` processor generates white/pink noise. Filtered through `BiquadFilterNode` for filtered/metallic variants. Shaped by ADSR envelope.

**ADSR Envelope:**

Implemented via `GainNode` with `linearRampToValueAtTime` / `exponentialRampToValueAtTime`.

6 presets:

| Preset | Attack | Decay | Sustain | Release |
|--------|--------|-------|---------|---------|
| LONG | 500ms | 200ms | 0.8 | 2000ms |
| SHORT | 10ms | 50ms | 0.3 | 100ms |
| SWELL | 1500ms | 100ms | 0.9 | 1000ms |
| PLUCK | 5ms | 300ms | 0.1 | 200ms |
| TOUCH | 20ms | 100ms | 0.7 | 300ms |
| SUSTAIN | 50ms | 50ms | 1.0 | 500ms |

Fine-tunable: Attack 1–2000ms, Release 1–5000ms (via hold function button + volume slider).

### 1.3 Looper (`src/audio/looper-worklet.ts` + `src/audio/looper.ts`)

AudioWorklet processor for glitch-free recording/playback. Main-thread controller manages UI state and sends commands via `MessagePort`.

- 6 audio tracks, ~20 seconds each (~960K samples per track at 48kHz)
- Track 1 sets loop length (free mode or 1–8 fixed bars)
- Loop length = `(bars × beatsPerBar × 60 / BPM) × sampleRate` — integer sample count, no drift
- Tracks 2–6 auto-sync to Track 1 length
- 4-beat metronome count-in before recording starts
- Auto-advance to next track after recording
- Per-track gain, mute, solo (all in worklet thread)
- Playback position wraps at exact sample count boundary

**Quantization:**
- Loop boundary: always snaps to exact bar/beat sample count
- Note input: optional grid snap (1/4, 1/8, 1/16) — audio triggers immediately for feel, recorded position aligns to grid
- No cumulative drift — integer modulo wrapping

**Looper state machine:** OFF → WAITING (set bar count) → RECORD (count-in then capture) → LOOP (playback) → OFF

### 1.4 Sequencer & Arpeggiator (`src/audio/clock.ts`)

Master clock using Web Audio precise scheduling (lookahead pattern):

```
scheduleAhead = 100ms
scheduleInterval = 25ms
setInterval: while nextNoteTime < currentTime + scheduleAhead → schedule, advance
```

**Arpeggiator:**
- 6 patterns: Up, Down, Up/Down, Down/Up, Random, Fingerpick
- 9 rates: 1/1, 1/2, 1/4, 1/8, 1/16, 1/16T, 1/32, Swing 8th, Swing 16th
- 3 chord modes: Arp Only, Chord+Arp, Rhythm+Arp
- Custom patterns (step arrays with octave/velocity/rest per step)

**Sequencer:**
- 16-step grid
- Each step stores: chord degree, joystick modification, duration
- Record mode: play chords in time, auto-quantize to steps
- Edit mode: tap grid cells to place/remove
- Auto-bounce to looper track when complete

**Tap tempo:** 3+ taps average interval → BPM (40–300 range).

### 1.5 Drum Engine (`src/audio/drums.ts`)

Sample-based. 7 kits × 7 samples each, stored as `AudioBuffer` arrays. Triggered via fire-and-forget `AudioBufferSourceNode`.

**7 Kits:** Tight, x0x Box (808), x9x Box (909), Lynn, KR-78, Trap Box, User Kit (uploaded samples).

**Button mapping in Drum mode:**
1: Kick, 2: Alt Kick, 3: Snare, 4: Closed HH, 5: Tom, 6: Bell/Ride, 7: Open HH/Cymbal

**56 pre-made patterns:** 7 genres (Rock, Disco, Reggae, Funk, Hip-Hop, Electro, Jazz) × 8 variations (Original, Ghost, Busy HH, Syncopated Kicks, Fills, Half-time, Double-time, Jazz). Stored as `{step, button, velocity}[]`.

**Auto-Drum:** Clock-driven drum hits from held chord buttons. Rates: 1/4, 1/8, 1/16, 1/32, Swing 8th, Swing 16th.

---

## 2. Effects Chain

Series chain: Input → Filter → Chorus → Flanger → Tremolo → Delay → Reverb → Stereo → Output

Each effect bypass-able independently.

| Effect | Implementation | Parameters |
|--------|---------------|------------|
| Filter | `BiquadFilterNode` (lowpass) | Cutoff 20Hz–20kHz, resonance |
| Reverb | `ConvolverNode` + generated impulse responses | Room, hall, plate, spring, ambient types |
| Delay | `DelayNode` + feedback `GainNode` | BPM-synced: 1/4, 1/8, 1/16, 1/16T |
| Chorus | Modulated `DelayNode` (LFO → delay time) | Light, warm, wide, lush presets |
| Flanger | Short modulated delay + feedback | Depth, rate |
| Tremolo | `GainNode` modulated by LFO `OscillatorNode` | 1/4 to 1/32 BPM-synced |
| LFO Vibrato | LFO → oscillator `.detune` | Low, Med, High depth |
| Glide | `linearRampToValueAtTime` on frequency | Short, med, long speed |
| Stereo | Stereo panner spread adjustment | Mono ↔ full stereo |
| Voice Count | Enable/disable voice pairs | 8, 4, 2, 1 oscillators |

---

## 3. Vocoder, Mic Sampling & Tuner

### 3.1 Vocoder

```
Mic → AnalyserNode (FFT bands) → band amplitudes
Synth → BiquadFilterNode bank (16-32 bandpass) → per-band GainNode → mix → output
```

Each band's gain modulated by corresponding mic frequency amplitude. Parameters: formant shift (±12 semitones), band Q (0.5–2.0), attack/release timing, noise level, gate threshold.

Sources: MIC (live microphone) or LOOP (looper track audio).

### 3.2 Mic Sampling

`MediaRecorder` API captures up to 3 seconds from built-in mic. Stored as `AudioBuffer`. Auto-pitch-detect via autocorrelation algorithm (in AudioWorklet). Transpose to C, playback at chord frequencies via `playbackRate`.

### 3.3 Tuner

`AnalyserNode` FFT on mic → autocorrelation pitch detection → display nearest note name + cents offset (needle visualization).

---

## 4. UI / Interaction Design

### 4.1 Layout (landscape, primary)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Gray] [Yellow] [Red]  │ OLED: C Major  Cmaj7  ♩♩♩  │  BPM:120    │
├────────────────────────┼────────────────────────────┼──────────────┤
│                        │                            │  ┌──┐┌──┐┌──┐│
│   ┌────────────────┐   │                            │  │ii││IV││vi││
│   │                │   │      (center area:         │  └┬─┘└┬─┘└┬─┘│
│   │  GESTURE PAD   │   │       mode-specific         │ ┌─┴──┬┴───┬┴──┬───┐
│   │  (joystick)    │   │       content)              │ │ I  │iii │ V │vii│
│   │                │   │                            │ │    │    │   │°  │
│   │  [mod label]   │   │                            │ └────┴────┴───┴───┘
│   └────────────────┘   │                            │              │
│        🔊 ━━━━━━━━━○   │                            │              │
├─────────────────────────┴────────────────────────────┴──────────────┤
│ T1██░░  T2░░░░  T3░░░░  T4░░░░  T5░░░░  T6░░░░ │ [⏺][⏹][▶] Q:1/8│
└─────────────────────────────────────────────────────────────────────┘
```

**Left zone (~40% width):** Gesture pad (large, 8-direction zones lightly outlined), volume slider below.

**Right zone:** Piano-key layout — 4 bottom "white keys" (I, iii, V, vii°) taller/lighter + 3 top "black keys" (ii, IV, vi) shorter/darker/raised. Multi-touch supported.

**Top bar:** 3 function buttons (Gray/Yellow/Red) left, compact OLED-style info display center (chord name, key, scale, note dots), BPM right.

**Center area:** Mode-dependent content (visualizer, sequencer grid, drum view, looper expanded, game/quiz).

**Bottom strip:** Looper track miniatures + transport controls. Collapsed by default, expands on looper mode.

### 4.2 Piano Key Chord Buttons

```
     ┌──┐  ┌──┐  ┌──┐
     │ii│  │IV│  │vi│       ← 3 "black keys" (shorter, raised, darker)
     │ 2│  │ 4│  │ 6│
   ┌─┴──┼──┴──┼──┴──┼───┐
   │ I  │iii  │ V   │vii°│  ← 4 "white keys" (taller, lighter)
   │ 1  │ 3   │ 5   │ 7  │
   └────┴─────┴─────┴────┘
```

White keys: ~75w × 200h px. Black keys: ~55w × 130h px. Visual feedback: color pulse on press, glow on hold.

### 4.3 Gesture Pad

Replaces joystick. ~320×280px on mobile. 8 directional zones with light outlines. Center position = default/neutral. Drag from center to modify chord quality. Shows current modifier label (e.g., "sus4", "dom7"). Dot tracks thumb position.

**Tap center** = joystick click (looper state cycle, randomize in menus).

**3 modes** (Default/Extended/Chromatic) cycled via swipe up on pad or through Yellow menu.

### 4.4 Complete Control Mapping

| HiChord Physical | Touch/Keyboard Equivalent |
|---|---|
| 7 chord buttons | Piano keys (right), keyboard: `H`=I, `U`=ii, `J`=iii, `K`=IV, `L`=V, `O`=vi, `;`=vii° |
| Joystick 8 dirs | Gesture pad drag, keyboard: `W/A/S/D/X` + diagonals |
| Joystick click | Tap pad center, keyboard: `Space` |
| Volume wheel | Vertical slider, keyboard: `Z`/`C` |
| Gray button | Top-left button, keyboard: `Q` |
| Yellow button | Top-center button, keyboard: `E` |
| Red button | Top-right button, keyboard: `R` |
| Gray + Volume | Hold `Q` + `Z`/`C` = attack adjust |
| Yellow + Volume | Hold `E` + `Z`/`C` = release adjust |
| Red + Volume | Hold `R` + `Z`/`C` = filter cutoff |
| Yellow + chord btn | Hold `E` + chord key = quick sound select |
| Red + chord btn | Hold `R` + chord key = quick mode select |
| Red × 3 taps | Triple-tap `R` = tap tempo |
| Chord + Yellow | Hold chord + tap `E` = cycle inversions |
| Chord + joystick + Yellow | Hold chord + drag + tap `E` = chord lock |
| Gray + Yellow | Long-press Gray = preset menu |
| Looper toggle | Tap pad center / `Space` |
| Looper track switch | Swipe L/R in looper view / `1`–`6` keys |
| Mixer mute/solo | Tap track (mute), long-press (solo) / `1`–`6` |
| Metronome toggle | Button 7 in mixer mode |

### 4.5 Menu Overlays

Tapping a function button opens overlay sliding up from that button. Chord buttons + gesture pad remain active underneath.

**Gray overlay:** Key selector (12 keys), octave shift (−1 to +2), scale dropdown (10 scales), per-button octave shift.

**Yellow overlay:** Instrument browser (swipe L/R), all effects with toggles and sliders, ADSR preset selector + fine-tune, bass mode, voice leading toggle, joystick mode, MIDI on/off, USB mode (audio/MIDI), speaker toggle.

**Red overlay:** Mode browser (15 modes), BPM slider + tap tempo button, mode-specific parameters (strum speed, arp pattern/rate/chord-layer, repeat rate, etc.).

Overlays close on outside tap or re-tap function button.

### 4.6 Center Area (mode-dependent)

| Mode | Center Content |
|------|---------------|
| Play, Strum, Lead, Drone, Repeat | Chord visualizer (note dots / mini piano roll) |
| Arpeggio | Animated pattern visualization, current step highlighted |
| Sequencer | 16-step grid, tap to place/remove chords |
| Drum / Drum Loops / Auto-Drum | Drum pad view or pattern visualizer |
| Looper / Mixer | Expanded 6-track waveform view + transport |
| Chord Hiro | Game: falling chord names, press correct button |
| Ear Trainer | Quiz: hear chord, identify type. 4 difficulty levels |
| Tuner | Pitch needle + note name + cents offset |
| Mic Sample | Waveform recording display + playback controls |

---

## 5. Touch Latency Mitigation

- Direct DOM `touchstart`/`pointerdown` listeners (bypass React synthetic events)
- CSS `touch-action: manipulation` on all interactive elements
- Pre-warmed `AudioContext` on first user gesture
- Direct engine refs: button touch → `engineRef.current.triggerChord(notes)` → `.start()`
- No state update in note trigger path — audio fires first, UI updates async
- Target: ~15–25ms touch-to-sound (hardware digitizer is the bottleneck)

---

## 6. Data & Storage

All local, IndexedDB via `idb` library:

```
hichord-app-db/
├── presets/       ← 4 quick slots + unlimited user presets
│   {id, name, params: {synthesis, effects, key, scale, octave,
│    inversions, chordLocks, filter, drumKit, sequencerPattern,
│    vocoderSettings, arpSettings, arpCustomPattern}}
├── samples/       ← user-uploaded audio (instruments)
│   {id, name, audioData: ArrayBuffer, pitchInfo}
├── drumKits/      ← custom drum kit sample sets
│   {id, name, samples: [7 ArrayBuffers]}
├── recordings/    ← exported looper sessions
│   {id, name, tracks: [6 Float32Arrays], bpm, bars}
└── settings/      ← app preferences
    {midiEnabled, speakerEnabled, quantize, theme, lastPreset}
```

Presets export as `.json` files. Samples import via file picker.

---

## 7. 15 Play Modes — Implementation

| # | Mode | Behavior |
|---|------|----------|
| 1 | Play (Oneshot) | Polyphonic chord trigger. Press = attack, release = release. No clock. |
| 2 | Strum | Sequential note trigger on press (slow: 80ms, med: 40ms, fast: 15ms intervals) |
| 3 | Lead | Monophonic single note. Last pressed wins, others cut. Uses chord's root or selected degree. |
| 4 | Drone | Infinite sustain on press. No release until mode change or explicit stop. |
| 5 | Arpeggio | Clock-driven pattern cycling through chord notes. 6 patterns, 9 rates, 3 chord modes. |
| 6 | Repeat | Clock-driven chord re-trigger at configurable rate. |
| 7 | Mic Sample | Record 3s via mic → auto-pitch-detect → playable at chord frequencies via playbackRate. |
| 8 | Drum Mode | Buttons trigger individual drum hits (kick/snare/HH/etc). |
| 9 | Drum Loops | 56 pre-made patterns. Buttons 1–7 select variation within current genre. |
| 10 | Auto-Drum | Hold chord button → drum hits at clock rate. Buttons map to drum sounds. |
| 11 | Sequencer | 16-step grid. Record or tap-edit chord progressions. Auto-bounce to looper. |
| 12 | Chord Hiro | Rhythm game. Falling chord names, press correct button in time. Score tracking. |
| 13 | Ear Trainer | Hear chord → identify type from options. 4 difficulty levels. |
| 14 | Tuner | Mic → pitch detection → nearest note + cents offset display. |
| 15 | Mixer | Buttons 1–6 = mute/unmute looper tracks. Hold + volume = track volume. Button 7 = metronome toggle. |

---

## 8. MIDI (Optional)

Web MIDI API (`navigator.requestMIDIAccess()`).

- MIDI output on channel 1 (up to 12 simultaneous notes)
- Velocity fixed at 100 (matching hardware)
- Sends note-on/note-off for all chord triggers, arp notes, drum hits
- Allows controlling external synths/DAWs from the app
- No MIDI input (HiChord hardware is output-only)

---

## 9. PWA & Android Packaging

### 9.1 PWA

- Vite + `vite-plugin-pwa` (Workbox)
- Service worker caches app shell + all instrument/drum samples
- Manifest: `display: "fullscreen"`, `orientation: "landscape"`
- Offline-capable after first load
- Install prompt on supported browsers

### 9.2 Capacitor (Android)

- `@capacitor/core` — WebView shell
- `@capacitor/screen-orientation` — lock landscape
- `@capacitor/keep-awake` — prevent sleep during play
- Web Audio + AudioWorklet supported in Android WebView (Chrome-based)
- Build APK/AAB for Play Store

---

## 10. Project Structure

```
hichord-app/
├── src/
│   ├── audio/
│   │   ├── engine.ts            ← AudioContext, voice management, routing
│   │   ├── synth-analog.ts      ← OscillatorNode synthesis
│   │   ├── synth-fm.ts          ← FM carrier/modulator pairs
│   │   ├── synth-sample.ts      ← AudioBufferSourceNode playback
│   │   ├── synth-noise.ts       ← Noise AudioWorklet processor
│   │   ├── effects.ts           ← Effects chain (all 10 effects)
│   │   ├── drums.ts             ← Drum sample engine
│   │   ├── vocoder.ts           ← Vocoder band processing
│   │   ├── looper-worklet.ts    ← AudioWorklet: record/play/mix
│   │   ├── looper.ts            ← Main-thread looper controller
│   │   └── clock.ts             ← Master scheduler (lookahead pattern)
│   ├── music/
│   │   ├── chord-engine.ts      ← Voicing generation, all 84K+ voicings
│   │   ├── scales.ts            ← 10 scale definitions
│   │   ├── voice-leading.ts     ← Smooth inversion selection
│   │   └── types.ts             ← Note, Chord, Scale, Key types
│   ├── input/
│   │   ├── touch-handler.ts     ← Direct DOM pointerdown listeners
│   │   ├── keyboard-handler.ts  ← Laptop key bindings
│   │   └── gesture-pad.ts       ← 8-direction vector detection
│   ├── store/
│   │   └── index.ts             ← Zustand: key, scale, mode, effects, tempo, presets
│   ├── components/
│   │   ├── Layout.tsx           ← Main landscape shell
│   │   ├── PianoKeys.tsx        ← 4+3 piano-key chord buttons
│   │   ├── GesturePad.tsx       ← Joystick replacement pad
│   │   ├── VolumeSlider.tsx     ← Volume wheel replacement
│   │   ├── FunctionButtons.tsx  ← Gray / Yellow / Red
│   │   ├── InfoBar.tsx          ← OLED-style top display
│   │   ├── CenterArea.tsx       ← Mode-dependent content router
│   │   ├── LooperView.tsx       ← 6-track waveforms + transport
│   │   ├── MenuOverlay.tsx      ← Settings panels (Key/Sound/Mode)
│   │   ├── SequencerGrid.tsx    ← 16-step chord editor
│   │   ├── DrumView.tsx         ← Drum pad / pattern display
│   │   ├── ChordHiro.tsx        ← Rhythm game mode
│   │   ├── EarTrainer.tsx       ← Chord quiz mode
│   │   └── Tuner.tsx            ← Pitch detection display
│   ├── data/
│   │   ├── instruments/         ← Sample audio files
│   │   ├── drum-kits/           ← 7 kit sample banks
│   │   ├── drum-patterns.ts     ← 56 pre-made beat patterns
│   │   └── presets.ts           ← Factory preset definitions
│   ├── db/
│   │   └── index.ts             ← IndexedDB via idb
│   ├── App.tsx
│   ├── main.tsx
│   └── sw.ts                    ← Service worker registration
├── public/
│   └── manifest.json
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 11. Testing Strategy

- **Chord Engine:** Unit tests (pure math). Every scale × key × degree × joystick direction. Voice leading correctness. Inversion cycling.
- **Audio Engine:** Integration tests with `OfflineAudioContext`. Verify oscillator frequencies, effect routing, ADSR timing.
- **Looper:** Verify sample-accurate loop boundaries, quantization alignment, track sync.
- **Clock/Sequencer:** Timing accuracy tests with `OfflineAudioContext`.
- **UI:** Component tests (Vitest + Testing Library). Touch event simulation. Keyboard binding coverage.
- **E2E:** Playwright for full flow: open app → select key → play chord → record loop → export preset.

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| Touch-to-sound latency | <25ms (hardware digitizer is bottleneck) |
| Audio scheduling jitter | <5ms (Web Audio lookahead pattern) |
| Looper drift | 0 samples (integer modulo wrapping) |
| UI frame rate | 60fps during playback |
| Initial load (cached) | <2s |
| Initial load (uncached) | <5s |
| Bundle size (excl. samples) | <500KB gzipped |
| Offline capability | Full (service worker) |
