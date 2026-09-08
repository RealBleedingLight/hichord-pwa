// src/components/MenuOverlay.tsx
import { useAppStore } from '@/store';
import { GrayOverlay } from './overlays/GrayOverlay';
import { YellowOverlay } from './overlays/YellowOverlay';
import { RedOverlay } from './overlays/RedOverlay';
import { panelStyle } from './overlays/shared';

const ACCENTS: Record<'gray' | 'yellow' | 'red', string> = {
  gray: '#aaaaaa',
  yellow: '#f0c040',
  red: '#e04040',
};

export function MenuOverlay() {
  const activeOverlay = useAppStore((s) => s.activeOverlay);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);

  if (!activeOverlay) return null;

  const accent = ACCENTS[activeOverlay];

  return (
    <div
      data-testid="overlay-backdrop"
      onPointerDown={() => setActiveOverlay(null)}
      style={{
        position: 'fixed',
        inset: 0,
        top: 44,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          ...panelStyle,
          maxWidth: 640,
          maxHeight: '70vh',
          background: '#16213e',
          borderTop: `3px solid ${accent}`,
          borderRadius: '0 0 10px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          animation: 'overlaySlideDown 0.18s ease-out',
        }}
      >
        {activeOverlay === 'gray' && <GrayOverlay />}
        {activeOverlay === 'yellow' && <YellowOverlay />}
        {activeOverlay === 'red' && <RedOverlay />}
      </div>
    </div>
  );
}
