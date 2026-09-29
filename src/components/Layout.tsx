// src/components/Layout.tsx
import { useEffect } from 'react';
import { FunctionButtons } from './FunctionButtons';
import { InfoBar } from './InfoBar';
import { GesturePad } from './GesturePad';
import { PianoKeys } from './PianoKeys';
import { VolumeSlider } from './VolumeSlider';
import { CenterArea, type CenterAreaProps } from './CenterArea';
import { MenuOverlay } from './MenuOverlay';
import { useAppStore } from '@/store';
import type { ScaleDegree, JoystickDirection, JoystickMode } from '@/music/types';
import { CYBER } from '@/theme';

interface LayoutProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  onDirectionChange: (dir: JoystickDirection) => void;
  onVolumeChange: (vol: number) => void;
  activeKeys: Set<ScaleDegree>;
  volume: number;
  joystickDirection: JoystickDirection;
  joystickMode: JoystickMode;
  centerAreaProps: CenterAreaProps;
  onToggleTransport: () => void;
  onLooperRecord: () => void;
  onLooperPlay: () => void;
}

const ROUND_BTN: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  background: CYBER.panel, border: '1px solid ' + CYBER.borderBright, color: '#eee',
  fontSize: 14, cursor: 'pointer', touchAction: 'manipulation',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const PILL_BTN: React.CSSProperties = {
  height: 30, padding: '0 10px', borderRadius: 15,
  background: 'transparent', border: '1px solid ' + CYBER.borderBright,
  fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
  touchAction: 'manipulation', whiteSpace: 'nowrap', fontFamily: CYBER.fontMono,
};

const TRACK_COLORS: Record<string, string> = {
  empty: '#3a2a2a',
  recording: CYBER.primary,
  playing: CYBER.green,
  muted: '#666',
};

/**
 * Always-visible bottom bar: the transport (beat + chord sequence) on the
 * left, the looper on the right. These are the controls people reach for
 * while playing, so they never hide behind a menu.
 */
function TransportBar({ onToggleTransport, onRecord, onPlay }: {
  onToggleTransport: () => void; onRecord: () => void; onPlay: () => void;
}) {
  const transportPlaying = useAppStore((s) => s.transportPlaying);
  const transportStep = useAppStore((s) => s.transportStep);
  const beatEnabled = useAppStore((s) => s.beatEnabled);
  const setBeatEnabled = useAppStore((s) => s.setBeatEnabled);
  const beatGenre = useAppStore((s) => s.beatGenre);
  const beatEdited = useAppStore((s) => s.beatEdited);
  const sequence = useAppStore((s) => s.sequence);
  const sequenceEnabled = useAppStore((s) => s.sequenceEnabled);
  const setSequenceEnabled = useAppStore((s) => s.setSequenceEnabled);
  const bpm = useAppStore((s) => s.bpm);
  const setBpm = useAppStore((s) => s.setBpm);
  const looperState = useAppStore((s) => s.looperState);
  const looperTracks = useAppStore((s) => s.looperTracks);
  const looperPhase = useAppStore((s) => s.looperPhase);
  const activeTrack = useAppStore((s) => s.activeTrack);
  const hasSequence = sequence.some(Boolean);
  const beatPulse = transportPlaying && transportStep !== null && transportStep % 4 === 0;

  const recLabel = looperState === 'waiting' ? 'COUNT-IN' : looperState === 'recording' ? 'REC' : null;

  return (
    <div style={{
      gridColumn: '1 / -1', background: CYBER.panelAlt, borderRadius: 6,
      borderTop: '1px solid ' + CYBER.border,
      display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
      fontSize: 11, color: CYBER.textDim, minWidth: 0, overflow: 'hidden',
    }}>
      <button
        data-testid="transport-play"
        aria-label={transportPlaying ? 'Stop beat and sequence' : 'Play beat and sequence'}
        onClick={onToggleTransport}
        style={{
          ...ROUND_BTN,
          background: transportPlaying ? CYBER.secondary : CYBER.panel,
          color: transportPlaying ? '#000' : CYBER.secondary,
          borderColor: CYBER.secondary,
          boxShadow: beatPulse ? '0 0 12px ' + CYBER.secondaryGlow : 'none',
        }}
      >
        {transportPlaying ? '■' : '▶'}
      </button>
      <button
        data-testid="beat-toggle"
        onClick={() => setBeatEnabled(!beatEnabled)}
        aria-pressed={beatEnabled}
        style={{ ...PILL_BTN, color: beatEnabled ? CYBER.amber : '#777', borderColor: beatEnabled ? CYBER.amber : '#333' }}
      >
        BEAT {beatGenre.toUpperCase()}{beatEdited ? '*' : ''}
      </button>
      <button
        data-testid="seq-toggle"
        onClick={() => setSequenceEnabled(!sequenceEnabled)}
        aria-pressed={sequenceEnabled}
        title={hasSequence ? '' : 'No chords in the sequence yet — build one in MODE → SEQ'}
        style={{
          ...PILL_BTN,
          color: sequenceEnabled && hasSequence ? CYBER.secondary : '#777',
          borderColor: sequenceEnabled && hasSequence ? CYBER.secondary : '#333',
        }}
      >
        SEQ{hasSequence ? '' : ' —'}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button aria-label="Slower" onClick={() => setBpm(bpm - 1)} style={{ ...PILL_BTN, padding: '0 8px', color: CYBER.textMid }}>−</button>
        <span style={{ minWidth: 52, textAlign: 'center', color: CYBER.textLight, fontFamily: CYBER.fontMono, fontSize: 12 }}>{bpm} BPM</span>
        <button aria-label="Faster" onClick={() => setBpm(bpm + 1)} style={{ ...PILL_BTN, padding: '0 8px', color: CYBER.textMid }}>+</button>
      </div>

      <span style={{ flex: 1 }} />

      <span style={{ fontSize: 10, letterSpacing: 1, color: CYBER.textDim }}>LOOP</span>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {looperTracks.map((t) => (
          <span
            key={t.index}
            title={`Track ${t.index + 1}: ${t.state}`}
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: TRACK_COLORS[t.state],
              outline: t.index === activeTrack ? '1px solid #ddd' : 'none',
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
      <div style={{ width: 48, height: 4, background: '#2a1010', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${looperState === 'off' ? 0 : looperPhase * 100}%`, height: '100%', background: CYBER.green }} />
      </div>
      {recLabel && (
        <span style={{ color: CYBER.primary, fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>{recLabel}</span>
      )}
      <button data-testid="bottom-looper-record" aria-label="Record loop" onClick={onRecord}
        style={{
          ...ROUND_BTN,
          color: CYBER.primary,
          background: looperState === 'recording' || looperState === 'waiting' ? CYBER.primary : CYBER.panel,
          boxShadow: looperState === 'recording' ? '0 0 10px ' + CYBER.primaryGlow : 'none',
        }}>
        <span style={{ color: looperState === 'recording' || looperState === 'waiting' ? '#fff' : CYBER.primary }}>●</span>
      </button>
      <button data-testid="bottom-looper-play" aria-label={looperState === 'off' ? 'Play loops' : 'Stop loops'} onClick={onPlay}
        style={{ ...ROUND_BTN, background: looperState === 'looping' ? CYBER.green : CYBER.panel, color: looperState === 'looping' ? '#000' : '#eee' }}>
        {looperState === 'off' ? '▶' : '■'}
      </button>
    </div>
  );
}

function Toast() {
  const toast = useAppStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      if (useAppStore.getState().toast?.id === toast.id) useAppStore.setState({ toast: null });
    }, 2200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 60, transform: 'translateX(-50%)',
      background: 'rgba(20,20,20,.95)', border: '1px solid ' + CYBER.borderBright,
      color: CYBER.textLight, padding: '8px 14px', borderRadius: 18, fontSize: 13,
      zIndex: 200, pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>
      {toast.text}
    </div>
  );
}

/** Modes whose center view needs the whole width (drum pads + step grid). */
const FULL_WIDTH_MODES: Set<string> = new Set(['drum', 'drumLoops', 'autoDrum']);

export function Layout(props: LayoutProps) {
  const playMode = useAppStore((s) => s.playMode);
  const isFullWidth = FULL_WIDTH_MODES.has(playMode);

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'grid',
      gridTemplateRows: '40px minmax(0, 1fr) 48px',
      gridTemplateColumns: isFullWidth ? 'minmax(0, 1fr)' : 'minmax(0, 32fr) minmax(0, 38fr) minmax(0, 30fr)',
      background: CYBER.bg,
      gap: 4,
      padding: 'max(4px, env(safe-area-inset-top)) max(4px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left))',
    }}>
      {/* Top bar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', gap: 8, minWidth: 0 }}>
        <FunctionButtons />
        <InfoBar />
      </div>

      {!isFullWidth && (
        /* Left: Gesture Pad + Volume */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <GesturePad
              onDirectionChange={props.onDirectionChange}
              direction={props.joystickDirection}
              mode={props.joystickMode}
            />
          </div>
          <VolumeSlider value={props.volume} onChange={props.onVolumeChange} />
        </div>
      )}

      {/* Center */}
      <div style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
        <CenterArea {...props.centerAreaProps} />
      </div>

      {!isFullWidth && (
        /* Right: Piano Keys */
        <div style={{ minHeight: 0 }}>
          <PianoKeys
            onKeyDown={props.onKeyDown}
            onKeyUp={props.onKeyUp}
            activeKeys={props.activeKeys}
          />
        </div>
      )}

      <TransportBar
        onToggleTransport={props.onToggleTransport}
        onRecord={props.onLooperRecord}
        onPlay={props.onLooperPlay}
      />

      <MenuOverlay leaveKeysUncovered={!isFullWidth} />
      <Toast />
    </div>
  );
}
