// src/components/VolumeSlider.tsx
import { useRef, useEffect } from 'react';
import { CYBER } from '@/theme';

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function VolumeSlider({ value, onChange }: VolumeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const update = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onChange(x);
    };

    let dragging = false;
    const down = (e: PointerEvent) => { dragging = true; el.setPointerCapture(e.pointerId); update(e); };
    const move = (e: PointerEvent) => { if (dragging) update(e); };
    const up = () => { dragging = false; };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, [onChange]);

  return (
    <div ref={sliderRef} style={{
      width: '100%',
      height: 18,
      background: CYBER.panel,
      border: '1px solid ' + CYBER.border,
      borderRadius: 4,
      position: 'relative',
      overflow: 'hidden',
      cursor: 'pointer',
      touchAction: 'none',
    }}>
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${value * 100}%`,
        background: 'linear-gradient(90deg, #ff1744, #e04040)',
        borderRadius: 3,
      }} />
      <div style={{
        position: 'absolute',
        left: `${value * 100}%`,
        top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 8,
        height: 14,
        background: CYBER.secondary,
        borderRadius: 2,
        boxShadow: '0 0 8px ' + CYBER.secondaryGlow,
      }} />
    </div>
  );
}
