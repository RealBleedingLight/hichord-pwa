// src/components/PianoKeys.tsx
import { useRef, useEffect, useCallback } from 'react';
import type { ScaleDegree } from '@/music/types';
import { CYBER } from '@/theme';

interface PianoKeysProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  activeKeys: Set<ScaleDegree>;
  labels: string[];
}

const WHITE_KEYS: ScaleDegree[] = [1, 3, 5, 7];
const BLACK_KEYS: ScaleDegree[] = [2, 4, 6];

export function PianoKeys({ onKeyDown, onKeyUp, activeKeys, labels }: PianoKeysProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-degree]');
      if (!target) return;
      const degree = Number(target.getAttribute('data-degree')) as ScaleDegree;
      (target as HTMLElement).setPointerCapture(e.pointerId);
      onKeyDown(degree);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest('[data-degree]');
      if (!target) return;
      const degree = Number(target.getAttribute('data-degree')) as ScaleDegree;
      onKeyUp(degree);
    };

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onKeyDown, onKeyUp]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* White keys (bottom layer) */}
      <div style={{ display: 'flex', position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', gap: 2 }}>
        {WHITE_KEYS.map((degree) => (
          <div
            key={degree}
            data-degree={degree}
            style={{
              flex: 1,
              background: activeKeys.has(degree) ? 'linear-gradient(180deg, #ff1744, #cc1133)' : 'linear-gradient(180deg, #2a0505, #1a0000)',
              border: '1px solid ' + CYBER.borderBright,
              borderRadius: 8,
              boxShadow: activeKeys.has(degree) ? '0 0 15px rgba(255,23,68,.6)' : 'none',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 12,
              fontSize: 14,
              fontWeight: 600,
              color: activeKeys.has(degree) ? '#fff' : CYBER.textLight,
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'background 0.05s',
            }}
          >
            {labels[degree - 1] ?? degree}
          </div>
        ))}
      </div>
      {/* Black keys (top layer) */}
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: '8%', right: '20%', height: '60%', gap: 4, justifyContent: 'space-between' }}>
        {BLACK_KEYS.map((degree) => (
          <div
            key={degree}
            data-degree={degree}
            style={{
              width: '28%',
              background: activeKeys.has(degree) ? 'linear-gradient(180deg, #ff1744, #cc1133)' : 'linear-gradient(180deg, #2a0505, #1a0000)',
              border: '1px solid ' + CYBER.border,
              borderRadius: 6,
              boxShadow: activeKeys.has(degree) ? '0 0 15px rgba(255,23,68,.6)' : 'none',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 8,
              fontSize: 12,
              fontWeight: 600,
              color: activeKeys.has(degree) ? '#fff' : CYBER.textDim,
              cursor: 'pointer',
              touchAction: 'manipulation',
              zIndex: 2,
              transition: 'background 0.05s',
            }}
          >
            {labels[degree - 1] ?? degree}
          </div>
        ))}
      </div>
    </div>
  );
}
