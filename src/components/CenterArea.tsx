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
