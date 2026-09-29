// src/components/PianoKeys.tsx
import { useRef, useEffect, useMemo } from 'react';
import type { ScaleDegree } from '@/music/types';
import { useAppStore } from '@/store';
import { getDegreeLabels } from '@/music/chord-engine';
import { CYBER } from '@/theme';

interface PianoKeysProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  activeKeys: Set<ScaleDegree>;
  /** Optional override of the key labels (defaults to the chord names in the current key). */
  labels?: string[];
}

const WHITE_KEYS: ScaleDegree[] = [1, 3, 5, 7];
const BLACK_KEYS: ScaleDegree[] = [2, 4, 6];

export function PianoKeys({ onKeyDown, onKeyUp, activeKeys, labels }: PianoKeysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const key = useAppStore((s) => s.key);
  const scale = useAppStore((s) => s.scale);
  const chordLocks = useAppStore((s) => s.chordLocks);
  const playMode = useAppStore((s) => s.playMode);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const degreeLabels = useMemo(() => getDegreeLabels(key, scale), [key, scale]);
  const writing = playMode === 'sequencer' && selectedSlot !== null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Which degree each pointer pressed, so the release goes to the same key
    // even if the finger slid off it.
    const pointers = new Map<number, ScaleDegree>();

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-degree]');
      if (!target) return;
      const degree = Number(target.getAttribute('data-degree')) as ScaleDegree;
      try { (target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      pointers.set(e.pointerId, degree);
      onKeyDown(degree);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const degree = pointers.get(e.pointerId)
        ?? (Number((e.target as HTMLElement).closest('[data-degree]')?.getAttribute('data-degree')) as ScaleDegree | 0);
      pointers.delete(e.pointerId);
      if (degree) onKeyUp(degree);
    };

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    // Long-press on touch opens a context menu / text selection otherwise.
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
      el.removeEventListener('contextmenu', block);
    };
  }, [onKeyDown, onKeyUp]);

  const renderLabel = (degree: ScaleDegree, isBlack: boolean) => {
    const info = degreeLabels[degree - 1];
    const main = labels?.[degree - 1] ?? info?.name ?? String(degree);
    const locked = chordLocks.some((l) => l.degree === degree);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pointerEvents: 'none' }}>
        <span style={{ fontSize: isBlack ? 14 : 17, fontWeight: 700, fontFamily: CYBER.fontDisplay, letterSpacing: 0.5 }}>
          {main}{locked ? ' 🔒' : ''}
        </span>
        {!labels && (
          <span style={{ fontSize: 11, opacity: 0.75, fontFamily: CYBER.fontMono }}>{info?.roman}</span>
        )}
      </div>
    );
  };

  const keyStyle = (degree: ScaleDegree, isBlack: boolean): React.CSSProperties => {
    const on = activeKeys.has(degree);
    return {
      background: on
        ? 'linear-gradient(180deg, #ff1744, #cc1133)'
        : isBlack ? 'linear-gradient(180deg, #1c0303, #0e0000)' : 'linear-gradient(180deg, #320808, #1c0202)',
      border: '1px solid ' + (writing ? CYBER.secondary : isBlack ? CYBER.border : CYBER.borderBright),
      borderRadius: isBlack ? 6 : 8,
      boxShadow: on ? '0 0 15px rgba(255,23,68,.6)' : isBlack ? '0 4px 8px rgba(0,0,0,.6)' : 'none',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: isBlack ? 8 : 12,
      color: on ? '#fff' : isBlack ? CYBER.textMid : CYBER.textLight,
      cursor: 'pointer',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transition: 'background 0.05s',
    };
  };

  return (
    <div ref={containerRef} data-testid="chord-keys" style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      {/* White keys (bottom layer) */}
      <div style={{ display: 'flex', position: 'absolute', inset: 0, gap: 3 }}>
        {WHITE_KEYS.map((degree) => (
          <div key={degree} data-degree={degree} aria-label={`Chord ${degreeLabels[degree - 1]?.name ?? degree}`} style={{ ...keyStyle(degree, false), flex: 1 }}>
            {renderLabel(degree, false)}
          </div>
        ))}
      </div>
      {/* Black keys (top layer), centred over the gaps between white keys */}
      {BLACK_KEYS.map((degree, i) => (
        <div
          key={degree}
          data-degree={degree}
          aria-label={`Chord ${degreeLabels[degree - 1]?.name ?? degree}`}
          style={{
            ...keyStyle(degree, true),
            position: 'absolute',
            top: 0,
            height: '55%',
            width: '21%',
            left: `${(i + 1) * 25 - 10.5}%`,
            zIndex: 2,
          }}
        >
          {renderLabel(degree, true)}
        </div>
      ))}
    </div>
  );
}
