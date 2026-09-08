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
