// src/components/MicSampleView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { MicSampler } from '@/audio/mic-sampler';

const ACCENT = '#4a9eff';

export function MicSampleView() {
  const samplerRef = useRef<MicSampler | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('Ready to record a sample');
  const [pitch, setPitch] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      samplerRef.current?.stop();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setPitch(null);
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new AudioContextCtor();
      ctxRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sampler = samplerRef.current ?? new MicSampler(ctx);
      samplerRef.current = sampler;

      setRecording(true);
      setStatus('Recording... tap again to stop');

      const buffer = await sampler.recordFromStream(stream);
      setStatus(`Captured ${buffer.duration.toFixed(2)}s sample`);
      const detected = sampler.getDetectedPitch();
      setPitch(detected > 0 ? detected : null);
      setRecording(false);
    } catch {
      setError('Microphone access denied');
      setRecording(false);
      setStatus('Ready to record a sample');
    }
  }, []);

  const stopRecording = useCallback(() => {
    samplerRef.current?.stop();
  }, []);

  const handleToggle = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording]);

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
      <div data-testid="mic-sample-status" style={{ fontSize: 14, color: '#889', textAlign: 'center' }}>
        {status}
      </div>

      {pitch !== null && (
        <div data-testid="mic-sample-pitch" style={{ fontSize: 12, color: '#667' }}>
          Detected pitch: {pitch.toFixed(1)} Hz
        </div>
      )}

      {error && <div style={{ color: '#e04040', fontSize: 12 }}>{error}</div>}

      <button
        data-testid="mic-sample-record"
        onClick={handleToggle}
        style={{
          minWidth: 160,
          minHeight: 44,
          borderRadius: 8,
          border: 'none',
          background: recording ? '#e04040' : ACCENT,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        {recording ? 'STOP RECORDING' : 'RECORD SAMPLE'}
      </button>
    </div>
  );
}
