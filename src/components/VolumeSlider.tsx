// src/components/VolumeSlider.tsx
import { useRef, useEffect } from 'react';

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
      const pct = 1 - (e.clientY - rect.top) / rect.height;
      onChange(Math.max(0, Math.min(1, pct)));
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
      height: 30,
      background: '#16213e',
      borderRadius: 4,
      position: 'relative',
      cursor: 'pointer',
      touchAction: 'none',
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${value * 100}%`,
        background: '#4a9eff',
        borderRadius: 4,
        transition: 'height 0.05s',
      }} />
    </div>
  );
}
