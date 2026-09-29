// src/components/ChordDisplay.tsx
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

const MODE_HINTS: Record<string, string> = {
  play: 'Hold a chord key to play',
  strum: 'Chords are strummed low → high',
  lead: 'Plays the top note only — melody lines',
  drone: 'Chords sustain until the next one',
  repeat: 'Held chords re-trigger in time',
  arpeggio: 'Held chords are arpeggiated in time',
};

/** Two octaves starting at C3; notes outside are folded in so they always show. */
const KEYBOARD_START = 48;
const KEYBOARD_KEYS = 36;
const BLACK = new Set([1, 3, 6, 8, 10]);

function MiniKeyboard({ midi }: { midi: number[] }) {
  const lit = new Set(midi.map((m) => {
    let n = m;
    while (n < KEYBOARD_START) n += 12;
    while (n >= KEYBOARD_START + KEYBOARD_KEYS) n -= 12;
    return n;
  }));
  const whites: number[] = [];
  for (let m = KEYBOARD_START; m < KEYBOARD_START + KEYBOARD_KEYS; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const w = 100 / whites.length;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: 44 }} aria-hidden>
      {whites.map((m, i) => (
        <rect key={m} x={i * w + 0.15} y={0} width={w - 0.3} height={24} rx={0.6}
          fill={lit.has(m) ? CYBER.primary : '#262626'} />
      ))}
      {whites.map((m, i) => {
        const black = m + 1;
        if (!BLACK.has(black % 12) || black >= KEYBOARD_START + KEYBOARD_KEYS) return null;
        return (
          <rect key={black} x={(i + 1) * w - w * 0.3} y={0} width={w * 0.6} height={14} rx={0.4}
            fill={lit.has(black) ? '#ff6680' : '#050505'} />
        );
      })}
    </svg>
  );
}

function Oscilloscope({ getAnalyser }: { getAnalyser?: () => AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext('2d');
    if (!canvas || !ctx2d || !getAnalyser) return;
    let raf = 0;
    let data: Float32Array | null = null;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const analyser = getAnalyser();
      const { width, height } = canvas;
      ctx2d.clearRect(0, 0, width, height);
      ctx2d.strokeStyle = CYBER.primary;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      if (!analyser) {
        ctx2d.moveTo(0, height / 2);
        ctx2d.lineTo(width, height / 2);
      } else {
        if (!data || data.length !== analyser.fftSize) data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data as Float32Array<ArrayBuffer>);
        // Start at a rising zero crossing so the trace holds still.
        let start = 0;
        for (let i = 1; i < data.length / 2; i++) {
          if (data[i - 1]! < 0 && data[i]! >= 0) { start = i; break; }
        }
        const span = data.length / 2;
        for (let i = 0; i < span; i++) {
          const x = (i / span) * width;
          const y = height / 2 - (data[start + i] ?? 0) * height * 0.9;
          if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        }
      }
      ctx2d.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser]);
  return <canvas ref={canvasRef} width={400} height={80} style={{ width: '100%', height: 44, display: 'block' }} />;
}

export function ChordDisplay({ getAnalyser }: { getAnalyser?: () => AnalyserNode | null }) {
  const chordName = useAppStore((s) => s.currentChordName);
  const chordMidi = useAppStore((s) => s.currentChordMidi);
  const playMode = useAppStore((s) => s.playMode);
  const synthMode = useAppStore((s) => s.synthMode);
  const sampleName = useAppStore((s) => s.sampleName);
  const arpPattern = useAppStore((s) => s.arpPattern);
  const arpRate = useAppStore((s) => s.arpRate);
  const hasPlayed = chordName !== '';

  let modeLine = MODE_HINTS[playMode] ?? '';
  if (playMode === 'arpeggio') modeLine = `Arp ${arpPattern} · ${arpRate}`;
  const soundLine = synthMode === 'sample' ? `SAMPLE · ${sampleName.toUpperCase()}` : synthMode.toUpperCase();

  return (
    <div data-testid="chord-display" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8,
      background: CYBER.panel,
      border: '1px solid ' + CYBER.border,
      borderRadius: 8,
      padding: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: CYBER.fontDisplay,
        fontSize: 'clamp(24px, 6vw, 44px)', fontWeight: 900,
        color: CYBER.textLight,
        textShadow: '0 0 20px ' + CYBER.secondaryGlow,
        letterSpacing: 2,
        minHeight: '1.2em',
        whiteSpace: 'nowrap',
      }}>{hasPlayed ? chordName : '—'}</div>

      <MiniKeyboard midi={chordMidi} />

      <div style={{ width: '100%', background: CYBER.bg, border: '1px solid ' + CYBER.border, borderRadius: 6, overflow: 'hidden' }}>
        <Oscilloscope getAnalyser={getAnalyser} />
      </div>

      <div style={{ fontSize: 12, color: CYBER.textDim, textAlign: 'center', lineHeight: 1.4 }}>
        {hasPlayed ? (
          <>
            <span style={{ color: CYBER.primary, letterSpacing: 2 }}>{soundLine}</span>
            {modeLine && <> · {modeLine}</>}
          </>
        ) : (
          <>Hold a <b style={{ color: CYBER.textLight }}>chord key</b> (right) and slide on the <b style={{ color: CYBER.textLight }}>pad</b> (left) to colour it.<br />
            Press <b style={{ color: CYBER.secondary }}>▶</b> below for a beat. <span style={{ opacity: 0.8 }}>Keyboard: H U J K L O ; · ? for help</span></>
        )}
      </div>
    </div>
  );
}
