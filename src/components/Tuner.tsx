// src/components/Tuner.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tuner as TunerEngine } from '@/audio/tuner';

const ACCENT = '#4a9eff';
const IN_TUNE_COLOR = '#2ecc71';
const CENTS_RANGE = 50;

export function Tuner() {
  const tunerRef = useRef<TunerEngine | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('--');
  const [cents, setCents] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      tunerRef.current?.stop();
    };
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new AudioContextCtor();
      ctxRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const tuner = tunerRef.current ?? new TunerEngine(ctx);
      tunerRef.current = tuner;
      tuner.onPitchDetected((n, c) => {
        setNote(n);
        setCents(c);
      });
      tuner.start(stream);
      setListening(true);
    } catch {
      setError('Microphone access denied');
      setListening(false);
    }
  }, []);

  const handleStop = useCallback(() => {
    tunerRef.current?.stop();
    setListening(false);
    setNote('--');
    setCents(0);
  }, []);

  const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents));
  const isInTune = listening && Math.abs(cents) <= 5;
  const needlePercent = 50 + (clampedCents / CENTS_RANGE) * 50;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 16,
    }}>
      <div
        data-testid="tuner-note"
        style={{
          fontSize: 64,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: isInTune ? IN_TUNE_COLOR : '#eee',
        }}
      >
        {note}
      </div>

      <div data-testid="tuner-cents" style={{ fontSize: 14, color: '#889' }}>
        {listening ? `${cents > 0 ? '+' : ''}${cents} cents` : 'Not listening'}
      </div>

      <div
        style={{
          width: '80%',
          maxWidth: 300,
          height: 12,
          background: '#0f1626',
          borderRadius: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#445', marginLeft: -1 }} />
        <div
          data-testid="tuner-needle"
          style={{
            position: 'absolute',
            left: `${needlePercent}%`,
            top: 0,
            bottom: 0,
            width: 4,
            marginLeft: -2,
            background: isInTune ? IN_TUNE_COLOR : ACCENT,
            borderRadius: 2,
            transition: 'left 0.1s ease-out',
          }}
        />
      </div>

      {error && <div style={{ color: '#e04040', fontSize: 12 }}>{error}</div>}

      <button
        data-testid="tuner-toggle"
        onClick={listening ? handleStop : handleStart}
        style={{
          minWidth: 140,
          minHeight: 44,
          borderRadius: 8,
          border: 'none',
          background: listening ? '#e04040' : ACCENT,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        {listening ? 'STOP' : 'START TUNER'}
      </button>
    </div>
  );
}
