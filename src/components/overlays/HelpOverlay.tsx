// src/components/overlays/HelpOverlay.tsx
import { sectionLabelStyle, sectionStyle } from './shared';
import { CYBER } from '@/theme';

const ACCENT = CYBER.secondary;

const STEPS: [string, string][] = [
  ['Play chords', 'The 7 keys on the right are the chords of your key (KEY menu). Hold one to play it.'],
  ['Colour them', 'While holding, touch the pad on the left: up = major↔minor, right = maj7, down = sus4… each zone is labelled.'],
  ['Pick a sound', 'SOUND: instrument, envelope, effects and presets. The keys stay playable while the menu is open.'],
  ['Add a beat', 'Press ▶ on the bottom bar. Choose / edit the groove in MODE → BEATS.'],
  ['Write a progression', 'Jam, then tap → SEQ under “recent chords” on the home screen. Or MODE → SEQ: ● REC and play in time over the beat, or STEP-enter chords. Sections A–D + SONG for verse/chorus.'],
  ['Layer loops', 'Press ● to record a loop (1-bar count-in, or on the next bar if the beat is running). Each new ● adds a synced layer. Loops are saved; export WAV in MODE → LOOPER.'],
];

const KEYS: [string, string][] = [
  ['H U J K L O ;', 'chord keys I – vii'],
  ['W A S D / arrows', 'pad directions (two keys = diagonal)'],
  ['Space', 'play / stop beat + sequence'],
  ['Enter', 'record loop layer'],
  ['Q · E · R', 'KEY · SOUND · MODE menus'],
  ['hold chord + pad + E', 'lock that colour to the chord key (or tap 🔒 LOCK)'],
  ['Z / C', 'volume down / up'],
  ['1 – 6', 'select loop track'],
  ['Esc', 'close menu'],
];

export function HelpOverlay() {
  return (
    <div style={{ color: CYBER.textLight, fontSize: 13, lineHeight: 1.45 }}>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Making a track in 6 steps</div>
        <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map(([title, text]) => (
            <li key={title}><b style={{ color: ACCENT }}>{title}.</b> <span style={{ color: '#ccc' }}>{text}</span></li>
          ))}
        </ol>
      </div>
      <div style={sectionStyle}>
        <div style={sectionLabelStyle(ACCENT)}>Keyboard</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 14px' }}>
          {KEYS.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <span style={{ fontFamily: CYBER.fontMono, color: CYBER.amber }}>{k}</span>
              <span style={{ color: '#ccc' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#999' }}>Your setup (key, sound, beat, progression) is saved automatically on this device.</div>
    </div>
  );
}
