// src/components/MenuOverlay.tsx
import { useAppStore } from '@/store';
import { GrayOverlay } from './overlays/GrayOverlay';
import { YellowOverlay } from './overlays/YellowOverlay';
import { RedOverlay } from './overlays/RedOverlay';
import { panelStyle } from './overlays/shared';
import { CYBER } from '@/theme';

const OVERLAY_STYLES: Record<'gray' | 'yellow' | 'red', { borderTop: string; border: string; boxShadow: string }> = {
  gray: {
    borderTop: '3px solid #aaa',
    border: '1px solid #555',
    boxShadow: '0 0 20px rgba(170,170,170,.1)',
  },
  yellow: {
    borderTop: '3px solid ' + CYBER.amber,
    border: '1px solid #554420',
    boxShadow: '0 0 20px rgba(240,192,64,.08)',
  },
  red: {
    borderTop: '3px solid ' + CYBER.primary,
    border: '1px solid #440000',
    boxShadow: '0 0 20px rgba(255,23,68,.08)',
  },
};

export function MenuOverlay() {
  const activeOverlay = useAppStore((s) => s.activeOverlay);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);

  if (!activeOverlay) return null;

  const overlayStyle = OVERLAY_STYLES[activeOverlay];

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
          background: CYBER.panelOverlay,
          borderTop: overlayStyle.borderTop,
          border: overlayStyle.border,
          borderRadius: 6,
          padding: '10px 14px',
          overflowY: 'auto',
          boxShadow: overlayStyle.boxShadow,
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
