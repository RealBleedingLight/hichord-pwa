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
