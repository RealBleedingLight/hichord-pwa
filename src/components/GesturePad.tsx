// src/components/GesturePad.tsx
import { useRef, useEffect, useState } from 'react';
import type { JoystickDirection } from '@/music/types';

interface GesturePadProps {
  onDirectionChange: (dir: JoystickDirection) => void;
  onCenterTap: () => void;
  currentLabel: string;
}

function vectorToDirection(dx: number, dy: number, deadzone: number): JoystickDirection {
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

export function GesturePad({ onDirectionChange, onCenterTap, currentLabel }: GesturePadProps) {
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
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    };

    const handleDown = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      setActive(true);
      const pos = getRelPos(e);
      startRef.current = pos;
      setDotPos(pos);
    };

    const handleMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      const pos = getRelPos(e);
      setDotPos(pos);
      const dx = pos.x - 50;
      const dy = pos.y - 50;
      const dir = vectorToDirection(dx, dy, 15);
      onDirectionChange(dir);
    };

    const handleUp = (e: PointerEvent) => {
      if (!startRef.current) return;
      const pos = getRelPos(e);
      const dx = Math.abs(pos.x - startRef.current.x);
      const dy = Math.abs(pos.y - startRef.current.y);
      if (dx < 5 && dy < 5) onCenterTap();

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

  return (
    <div
      ref={padRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#16213e',
        borderRadius: 12,
        border: '2px solid #2a3a5c',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* Direction zone lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#4a9eff" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#4a9eff" />
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="#4a9eff" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke="#4a9eff" />
      </svg>
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
          background: active ? '#4a9eff' : '#3a5a8c',
          transition: active ? 'none' : 'all 0.15s ease-out',
          boxShadow: active ? '0 0 20px rgba(74,158,255,0.5)' : 'none',
        }}
      />
      {/* Label */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 13,
        color: '#4a9eff',
        fontWeight: 600,
      }}>
        {currentLabel || 'DEFAULT'}
      </div>
    </div>
  );
}
