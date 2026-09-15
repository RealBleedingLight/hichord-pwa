// src/components/FunctionButtons.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

export function FunctionButtons() {
  const activeOverlay = useAppStore((s) => s.activeOverlay);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);
  const setHeld = useAppStore((s) => s.setHeldFunctionButton);

  const buttons = [
    {
      id: 'gray' as const,
      label: 'KEY',
      color: '#999',
      border: '1px solid rgba(136,136,136,.3)',
      textShadow: '0 0 8px rgba(170,170,170,.4)',
      activeBg: '#888',
    },
    {
      id: 'yellow' as const,
      label: 'SOUND',
      color: CYBER.amber,
      border: '1px solid rgba(240,192,64,.4)',
      textShadow: '0 0 10px ' + CYBER.amberGlow,
      activeBg: CYBER.amber,
    },
    {
      id: 'red' as const,
      label: 'MODE',
      color: CYBER.primary,
      border: '1px solid rgba(255,23,68,.4)',
      textShadow: '0 0 10px ' + CYBER.primaryGlow,
      activeBg: CYBER.primary,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {buttons.map((btn) => {
        const active = activeOverlay === btn.id;
        return (
          <button
            key={btn.id}
            onPointerDown={() => setHeld(btn.id, true)}
            onPointerUp={() => { setHeld(btn.id, false); setActiveOverlay(activeOverlay === btn.id ? null : btn.id); }}
            style={{
              background: active ? btn.activeBg : 'transparent',
              border: active ? 'none' : btn.border,
              borderRadius: 4,
              padding: '4px 12px',
              color: active ? '#fff' : btn.color,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1px',
              textShadow: active ? 'none' : btn.textShadow,
              boxShadow: active ? '0 0 10px ' + btn.activeBg : 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
}
