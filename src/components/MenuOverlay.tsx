// src/components/MenuOverlay.tsx
import { useAppStore } from '@/store';
import { GrayOverlay } from './overlays/GrayOverlay';
import { YellowOverlay } from './overlays/YellowOverlay';
import { RedOverlay } from './overlays/RedOverlay';
import { HelpOverlay } from './overlays/HelpOverlay';
import { panelStyle } from './overlays/shared';
import { CYBER } from '@/theme';

const OVERLAY_STYLES: Record<'gray' | 'yellow' | 'red' | 'help', { borderTop: string; border: string; boxShadow: string }> = {
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
  help: {
    borderTop: '3px solid ' + CYBER.secondary,
    border: '1px solid #114450',
    boxShadow: '0 0 20px rgba(0,229,255,.08)',
  },
};

interface MenuOverlayProps {
  /**
   * Keep the chord keys (right ~30%) and the bottom bar uncovered so they stay
   * playable — you can audition a sound or a scale while choosing it.
   */
  leaveKeysUncovered?: boolean;
}

export function MenuOverlay({ leaveKeysUncovered = false }: MenuOverlayProps) {
  const activeOverlay = useAppStore((s) => s.activeOverlay);
  const setActiveOverlay = useAppStore((s) => s.setActiveOverlay);

  if (!activeOverlay) return null;

  const overlayStyle = OVERLAY_STYLES[activeOverlay];
  const coverRight = leaveKeysUncovered && activeOverlay !== 'help' ? '31%' : 0;

  return (
    <div
      data-testid="overlay-backdrop"
      onPointerDown={() => setActiveOverlay(null)}
      style={{
        position: 'fixed',
        top: 48,
        left: 0,
        right: coverRight,
        bottom: 56,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 8px',
      }}
    >
      <div
        role="dialog"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          ...panelStyle,
          maxWidth: 680,
          maxHeight: '100%',
          background: CYBER.panelOverlay,
          borderTop: overlayStyle.borderTop,
          border: overlayStyle.border,
          borderRadius: 6,
          padding: '10px 14px',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          boxShadow: overlayStyle.boxShadow,
          animation: 'overlaySlideDown 0.18s ease-out',
          position: 'relative',
        }}
      >
        <button
          aria-label="Close"
          onClick={() => setActiveOverlay(null)}
          style={{
            position: 'sticky', top: 0, alignSelf: 'flex-end', marginBottom: -28, zIndex: 1,
            width: 28, height: 28, borderRadius: '50%', border: '1px solid #333',
            background: '#181818', color: '#bbb', cursor: 'pointer', fontSize: 14, flexShrink: 0,
          }}
        >
          ✕
        </button>
        {activeOverlay === 'gray' && <GrayOverlay />}
        {activeOverlay === 'yellow' && <YellowOverlay />}
        {activeOverlay === 'red' && <RedOverlay />}
        {activeOverlay === 'help' && <HelpOverlay />}
      </div>
    </div>
  );
}
