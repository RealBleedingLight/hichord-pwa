# HiChord PWA — Product Review & Optimisation Pass (2026-09-29)

## How this review was done

- Read every source file (audio engine, music theory, store, UI) against the design spec and implementation plan in `docs/superpowers/`.
- Ran the app in headless Chromium at phone-landscape size (844×390) and went through it as a user would: play chords → pick a sound → add a beat → write a progression → loop layers.
- Measured the real audio output (peak/RMS from an `AnalyserNode`) for every instrument and mode, rather than trusting the unit tests. The unit tests all passed while several headline features made no sound at all.

## The core workflow, and where it broke

The product only needs to do one thing well: **get from "I have an idea" to "I'm hearing a chord progression over a beat, layered in loops" fast.** Here's how that went before this pass.

| Step | Before | Verdict |
|---|---|---|
| 1. Play chords | Keys labelled `I ii iii…` whatever the key/scale. You had to work out that `vi` in C is Am. | Friction |
| 2. Colour chords (pad) | Only 4 of 8 zones labelled, and 2 of those were **wrong** (`aug` sat where `maj7` actually is). The label showed raw names like `upRight`. | Broken |
| 3. Legato playing | Press C, press G, release C → **G went silent**. Every legato chord change cut out. | Broken |
| 4. Pick a sound | The menu covered the chord keys, so you couldn't hear what you were choosing. **SAMPLE and NOISE were silent** (no samples shipped; the noise worklet was never loaded). 4 of 10 effect sliders did nothing. | Broken |
| 5. Volume | Chords summed to ~6× full scale: 3–6 note saw chords clipped hard. | Broken |
| 6. Pentatonic / blues | Pressing vi or vii° produced `NaN` frequencies (throws in real browsers). | Crash |
| 7. Add a beat | Beats only ran inside the LOOPS mode, and in that mode the chord keys turned into drums. **You couldn't play chords over a beat.** The beat ran at the arp rate (default 1/8), so it played at half speed. All 7 drum kits sounded identical, and 12 of 16 pads were copies of other pads. The step grid beside the pattern browser didn't play anything. | Broken |
| 8. Write a progression | Sequencer started playing the moment you opened it, with no stop button. Tapping a cell cycled I→II→…→VII (7 taps to reach vii). The chord keys were hidden, so you couldn't audition. MELODY/BASS/DRUMS rows and LOOP/ONCE/+TRACK/QUANTIZE/EXPORT buttons did nothing. | Broken |
| 9. Loop layers | Tracks 2–6 started at position 0 from whenever you pressed record, **not in phase with track 1**, so every overdub drifted. Fixed-length recordings never updated the UI (stuck on "REC"). The looper recorded the dry signal and played back without effects, straight to the speakers (bypassing volume). No count-in or click, even though the store had a metronome flag. | Broken |
| 10. Come back tomorrow | Nothing persisted. Presets could be saved to IndexedDB but there was no UI to load or save them. | Missing |
| Timing everywhere | Clock callbacks triggered notes immediately instead of at their scheduled time, so arp/beat notes fired up to 100 ms early with ~25 ms jitter. | Broken |

**What worked:** the chord theory engine (scales, qualities, 24 pad modifications, inversions, voice-leading maths), the drum-pattern library, the FM/analog voice design, the game modes, and the overall landscape layout idea (pad left, keys right). The test suite was healthy but tested components in isolation. It never caught that features weren't wired together.

## What changed

### Sound (engine)
- **Proper gain staging:** per-voice level scales with note count, plus a limiter on the master bus. Measured peak with a 6-note chord + bass at full volume: 0.72 (was well over 1).
- **Click-free voices:** new chords fade the old ones in about 4 ms instead of hard-cutting them to 0. Releases use exponential envelopes. A shared `VoiceSet` tracks held, releasing and scheduled voices.
- **Sample-accurate timing:** synths and drums accept a `when` time. Arp, repeat, beat, sequencer and metronome now schedule on the clock's exact time.
- **Separate clocks** for the arp/repeat rate, the transport (16ths) and the metronome, so they never change each other's speed.
- **Voice groups:** the chord sequence plays on its own voices, so live chords don't cut it off (and vice versa).
- **SAMPLE mode works:** 4 built-in instruments (Keys, Pluck, Bell, Pad) are rendered procedurally, so there's nothing to download.
- **NOISE mode works:** it's now pitched, with one resonant band-pass per chord note.
- **Mic sample → instrument:** a recording is trimmed, pitch-detected, and becomes the "MY MIC" instrument, playable from the chord keys.
- **Strum** plays one chord with staggered note starts, instead of re-triggering the chord for every note.
- **Drums:** 6 kits with distinct characters (808 boom, 909 punch, trap sub…). All 19 sounds are now distinct: clap, rim, cowbell, crash, ride, shaker, FX, and so on. Drums skip the synth effects.
- **Delay effect** is tempo-synced (dotted 8th) and follows BPM changes.
- **Signal flow:** the looper records the post-FX mix and plays back through the limiter and volume.

### Playing
- Keys show the **real chord names** (C, Dm, Em…) with roman numerals underneath, updated for key and scale.
- **Legato fixed:** releasing an older key keeps the newest chord sounding. Releasing the sounding key falls back to one that's still held.
- The **pad labels all 8 zones** for the current chord set and highlights the active one. Touching a zone applies it straight away.
- **Voice leading** and **per-chord octave / inversion** now do something. They were in the store and UI but never applied. The KEY menu shows them as a per-chord table.
- The **slash-bass** option ("FIFTH BELOW") now plays the fifth; before, it behaved the same as root.
- Pentatonic and blues scales harmonise from their parent scale, so all 7 keys work.
- Keyboard: two direction keys make a diagonal (W+D = up-right), arrow keys work, **Space** = play/stop, **Enter** = record a loop, **Esc** closes menus, **?** opens help. Keys no longer get stuck when the window loses focus.

### Making a track
- **Transport bar** (always visible at the bottom): ▶/■, beat on/off (showing the groove name), sequence on/off, BPM −/+, and the looper (track lights, loop progress, ●, ▶/■).
- **Beat and sequence run together on one transport, in every mode.** You can play chords over a beat now.
- **BEATS view:** pick a genre and variation, and the step grid *is* the beat. Tap cells to edit, with a live playhead.
- **Sequencer rebuilt around step entry:** tap slot 1, then press chord keys. Each chord (with any pad colour) is written and the next slot is selected. Sliding the pad while a key is held refines the step you just wrote. Empty slots hold the previous chord. There are play and clear buttons, and per-slot ✕. The dead rows and buttons are gone.
- **Looper:** the first track sets the loop (1-bar count-in with a click, or starts on the next bar if the beat is running). Every later track records exactly one cycle, phase-locked to the loop. It moves to the next empty track automatically. You can clear a single track or all of them, and turn the click on or off. The UI tracks record, done and cancelled states through events from the worklet.

### UI / UX
- **Menus leave the chord keys and bottom bar uncovered,** so you can audition sounds and scales while choosing them. There's also a close ✕.
- **MODE menu** groups modes (Play chords / Build a song / Tools & games), gives each a one-line description, and shows only the settings the selected mode uses.
- **SOUND menu:** load/save/delete presets (factory presets plus your own), pick sample instruments, see the real ADSR curve, and use a log-scaled filter. Effects are toggled by tapping their name, and moving a slider switches the effect on. The dead controls (vibrato, glide, stereo, voice count, swing rates, arp chord-layer modes, user kit) are hidden until they're implemented.
- **Home screen:** a big current-chord display, a mini keyboard showing the notes, a live oscilloscope, and a first-run hint.
- **Help overlay (?):** the six-step workflow plus the keyboard map.
- **Toasts** for events like "Track 2 recorded", "Saved preset" and "Sample ready".
- **Session persistence:** key, sound, effects, beat, progression, tempo and so on survive reloads (localStorage).
- Contrast pass: body text went from about 2:1 dark-red-on-black to at least 4.5:1. Minimum text size is now about 10–11 px (was 7–8 px). Larger touch targets. `100dvh` and safe-area insets for phones.
- The top bar's key/scale and mode are tappable shortcuts into their menus. The fake level meter and fake waveform are gone.

## Verified

- `tsc` clean, `vite build` passes, and **277 tests pass** (35 new or rewritten for the new behaviour).
- In Chromium, measured audio: every instrument and mode produces sound, and no path clips. Stopping the transport and releasing keys goes to true silence. Legato keeps the new chord. The looper goes count-in → record → auto-advance → synced overdub.

## Still open (ranked)

1. **Loops aren't saved.** Looper audio is lost on reload, and there's no WAV export or "bounce". This is the biggest remaining gap for "making music" rather than jamming.
2. **Song structure:** a single 4-bar progression. Next steps would be multiple patterns (A/B), chaining, and per-slot length.
3. **Changing BPM with loops recorded** keeps the loop at its original length, so the grid drifts from the beat. The BPM control should lock (or warn) while loops exist.
4. **Chord lock** has store support but no UI (the spec says: hold chord + pad + SOUND).
5. **Vocoder** (`src/audio/vocoder.ts`) is implemented but not wired into any mode.
6. **Hidden, unimplemented features:** arp CHORD+ARP / RHYTHM+ARP, swing rates, vibrato, glide, stereo width, voice count, and the user drum kit.
7. **MIDI:** access is requested on load with no device picker or on/off switch.
8. **Portrait phones** get a "rotate" wall. A stacked portrait layout (keys at the bottom, pad above) would make the first open smoother.
9. The **Tuner and Mic** views create their own AudioContext. They should share the engine's.
10. **Beat feel:** no swing or humanise, and no velocity editing in the grid.
