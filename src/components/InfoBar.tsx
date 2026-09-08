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
