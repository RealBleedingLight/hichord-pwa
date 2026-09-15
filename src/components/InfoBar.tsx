// src/components/InfoBar.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

const METER_HEIGHTS = [40, 60, 80, 50, 30];

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
      fontFamily: CYBER.fontMono,
    }}>
      <span style={{ color: CYBER.secondary, fontSize: 12, fontWeight: 600 }}>{key} {scale}</span>
      <span style={{ fontFamily: CYBER.fontDisplay, fontWeight: 700, color: CYBER.textLight, fontSize: 16 }}>{chordName || '—'}</span>
      <span style={{ color: CYBER.primary, fontSize: 10 }}>{playMode}</span>
      <span style={{ color: CYBER.textDim, fontSize: 10 }}>BPM:{bpm}</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
        {METER_HEIGHTS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: `${h}%`,
              background: i < 3 ? CYBER.primary : '#220000',
              boxShadow: i < 3 ? '0 0 6px ' + CYBER.primaryGlow : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
