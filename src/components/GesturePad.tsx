// src/components/GesturePad.tsx
import { useRef, useEffect, useState } from 'react';
import type { JoystickDirection, JoystickMode } from '@/music/types';
import { directionLabel } from '@/music/chord-engine';
import { CYBER } from '@/theme';

interface GesturePadProps {
  onDirectionChange: (dir: JoystickDirection) => void;
  direction: JoystickDirection;
  mode: JoystickMode;
  onCenterTap?: () => void;
}

export function vectorToDirection(dx: number, dy: number, deadzone: number): JoystickDirection {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < deadzone) return 'center';

  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'upRight';
  if (angle >= 67.5 && angle < 112.5) return 'up';
  if (angle >= 112.5 && angle < 157.5) return 'upLeft';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'downLeft';
  if (angle >= -112.5 && angle < -67.5) return 'down';
  return 'downRight';
}

/** Label positions (percent of pad) for each direction. */
const LABEL_POS: Record<Exclude<JoystickDirection, 'center'>, { left: number; top: number }> = {
  up: { left: 50, top: 11 },
  upRight: { left: 84, top: 16 },
  right: { left: 88, top: 50 },
  downRight: { left: 84, top: 84 },
  down: { left: 50, top: 89 },
  downLeft: { left: 16, top: 84 },
  left: { left: 12, top: 50 },
  upLeft: { left: 16, top: 16 },
};

/**
 * Chord-colour pad (the hardware joystick). Touch anywhere and the chord
 * modifier follows the finger's position relative to the pad centre; lift
 * to return to the plain chord. Every zone is labelled for the current
 * joystick mode so it's clear what each direction does.
 */
export function GesturePad({ onDirectionChange, direction, mode, onCenterTap }: GesturePadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 });
  const [active, setActive] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = padRef.current;
    if (!el) return;

    const getRelPos = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
      };
    };

    const update = (pos: { x: number; y: number }) => {
      setDotPos(pos);
      onDirectionChange(vectorToDirection(pos.x - 50, pos.y - 50, 14));
    };

    const handleDown = (e: PointerEvent) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      setActive(true);
      const pos = getRelPos(e);
      startRef.current = pos;
      update(pos);
    };

    const handleMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      update(getRelPos(e));
    };

    const handleUp = (e: PointerEvent) => {
      if (!startRef.current) return;
      const pos = getRelPos(e);
      const dx = Math.abs(pos.x - startRef.current.x);
      const dy = Math.abs(pos.y - startRef.current.y);
      if (dx < 5 && dy < 5) onCenterTap?.();

      startRef.current = null;
      setActive(false);
      setDotPos({ x: 50, y: 50 });
      onDirectionChange('center');
    };

    el.addEventListener('pointerdown', handleDown, { passive: false });
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
    el.addEventListener('pointercancel', handleUp);

    return () => {
      el.removeEventListener('pointerdown', handleDown);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
      el.removeEventListener('pointercancel', handleUp);
    };
  }, [onDirectionChange, onCenterTap]);

  const activeLabel = directionLabel(direction, mode);

  return (
    <div
      ref={padRef}
      data-testid="gesture-pad"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at 50% 50%, #260606 0%, ${CYBER.panel} 55%, #120000 100%)`,
        borderRadius: 8,
        border: '1px solid ' + CYBER.border,
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Zone dividers */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <circle cx="50" cy="50" r="14" fill="none" stroke={CYBER.primary} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        {[22.5, 67.5, 112.5, 157.5].map((a) => {
          const r = (a * Math.PI) / 180;
          return (
            <line key={a} x1={50 - 80 * Math.cos(r)} y1={50 + 80 * Math.sin(r)} x2={50 + 80 * Math.cos(r)} y2={50 - 80 * Math.sin(r)}
              stroke={CYBER.primary} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>
      {/* Direction labels */}
      {(Object.keys(LABEL_POS) as (keyof typeof LABEL_POS)[]).map((dir) => {
        const pos = LABEL_POS[dir];
        const on = direction === dir;
        return (
          <div
            key={dir}
            style={{
              position: 'absolute', left: `${pos.left}%`, top: `${pos.top}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 12, fontFamily: CYBER.fontMono, fontWeight: 700,
              color: on ? '#fff' : 'rgba(255,120,140,.6)',
              textShadow: on ? '0 0 8px ' + CYBER.primaryGlow : 'none',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}
          >
            {directionLabel(dir, mode)}
          </div>
        );
      })}
      {/* Thumb dot */}
      <div
        style={{
          position: 'absolute',
          left: `${dotPos.x}%`,
          top: `${dotPos.y}%`,
          transform: 'translate(-50%, -50%)',
          width: active ? 40 : 24,
          height: active ? 40 : 24,
          borderRadius: '50%',
          background: 'transparent',
          border: '2px solid ' + CYBER.primary,
          transition: active ? 'none' : 'all 0.15s ease-out',
          boxShadow: '0 0 12px ' + CYBER.primaryGlow + ', inset 0 0 6px rgba(255,23,68,.2)',
          pointerEvents: 'none',
        }}
      />
      {/* Mode / current modifier */}
      <div style={{
        position: 'absolute', top: 4, left: 6,
        fontSize: 10, color: CYBER.textDim, letterSpacing: 1.5, fontWeight: 700, pointerEvents: 'none',
      }}>
        {mode.toUpperCase()}
      </div>
      {activeLabel && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 18, fontFamily: CYBER.fontDisplay, fontWeight: 800, color: '#fff',
          textShadow: '0 0 12px ' + CYBER.primaryGlow, pointerEvents: 'none', opacity: 0.35,
        }}>
          {activeLabel}
        </div>
      )}
    </div>
  );
}
