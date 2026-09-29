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

## Round 2 (same day): hidden features made live + the four picks

### Previously hidden, now working
- **Swing:** the SWING 8/16 arp rates and a STRAIGHT / LIGHT / SHUFFLE control for the beat and sequence, done as real per-step timing offsets in the clock.
- **Arp layers:** CHORD + ARP (the chord sustains under an arp an octave up) and PULSE + ARP (the chord pulses on every beat under the arp). Each has its own voice group.
- **Vibrato, glide, stereo width, voice limit:** a shared vibrato LFO feeds every oscillator's detune. Glide slides each voice from the previous chord's pitch. Width sets the stereo spread of chord notes. VOICES caps notes at 1, 2, 3, 4 or all.
- **USER drum kit:** load any audio file onto any pad. It's saved in IndexedDB and restored on launch.
- **MIDI out:** off by default with no permission prompt on load. Switch it on and pick the output in SOUND. Devices plugged in later are picked up.
- **Tuner and Mic** now use the engine's AudioContext instead of creating their own.
- **Beat velocity:** tapping a cell cycles full → soft (ghost note) → off.
- **Mix:** SYNTH / BEAT / LOOPS levels in the looper view.

### The four picks
1. **Loops persist and export.** Looper audio is saved to IndexedDB after every change (it's resampled if the device's sample rate differs) and restored on launch. **⤓ WAV** and **⤓ ×4** download the mix, with gains and mutes applied and peaks normalised.
2. **Song sections.** Four 4-bar sections, A–D, with copy between them. A SONG row arranges them (for example A A B A), and song mode plays the arrangement. The bottom bar shows the section that's playing. Tied chords carry across section boundaries.
3. **Tempo is locked while loops exist.** Recorded loops are fixed-length audio, so changing BPM would slide the beat off them. The BPM controls now refuse the change with a message and show 🔒. Restored loops also restore their tempo. Clearing the loops unlocks it.
4. **Chord lock and vocoder have controls.** Hold a chord, move the pad, then tap **🔒 LOCK** (or press E, as on the hardware). The KEY menu lists locks so you can remove them. VOCODER mode routes the synths through a 16-band vocoder driven by the mic, with formant shift and a noise gate.

### Smoothness fixes done along the way
- **Chord colour changes morph instead of re-attacking.** On sustained sounds, moving the pad (or letting go of the newer of two held keys) retunes the voices in place. Shared notes keep ringing and new ones fade in, so there are no swell restarts or gaps. A new key press still re-attacks, which is what you want for plucks.
- **Every knob is de-zippered:** filter, reverb, delay, chorus and the rest glide over about 15 ms instead of jumping. So do master volume and the mix levels.
- **Voices clean up after themselves,** including their vibrato connections, so long sessions don't slowly get heavier.

## Still open (ranked)

What's left for a smooth, seamless feel:

1. **Touch-to-sound latency on Android.** Measure it on a real device. If it's high, move to `pointerrawupdate`, a smaller `latencyHint` (for example 0.01), and AudioWorklet-based voices.
2. **Real-time progression recording:** play chords over the beat and have them quantised into the section, as an alternative to step entry.
3. **Better instruments:** real multi-sampled piano, strings and guitar, loaded on demand. The procedural ones are fine for sketching.
4. **Reverb quality:** the reverb's impulse response is plain decaying noise. A designed plate or hall would sound much more polished.
5. **Per-track loop volume and pan, and undo for the last overdub.**
6. **A fill or crash into each new section, and per-section beat variations** (a busier groove on the chorus).
7. **Time-stretched loops,** so tempo could stay unlocked.
8. **MIDI clock out and MIDI input** for playing the chords from a controller.
9. **Chord Hero and Ear Trainer** weren't reworked this round.
