// src/components/Layout.tsx
import { FunctionButtons } from './FunctionButtons';
import { InfoBar } from './InfoBar';
import { GesturePad } from './GesturePad';
import { PianoKeys } from './PianoKeys';
import { VolumeSlider } from './VolumeSlider';
import { CenterArea, type CenterAreaProps } from './CenterArea';
import { MenuOverlay } from './MenuOverlay';
import { useAppStore } from '@/store';
import type { ScaleDegree, JoystickDirection } from '@/music/types';
import { CYBER } from '@/theme';

interface LayoutProps {
  onKeyDown: (degree: ScaleDegree) => void;
  onKeyUp: (degree: ScaleDegree) => void;
  onDirectionChange: (dir: JoystickDirection) => void;
  onCenterTap: () => void;
  onVolumeChange: (vol: number) => void;
  activeKeys: Set<ScaleDegree>;
  volume: number;
  currentModLabel: string;
  chordLabels: string[];
  centerAreaProps: CenterAreaProps;
  onLooperRecord: () => void;
  onLooperStop: () => void;
  onLooperPlay: () => void;
}

const LOOP_BTN: React.CSSProperties = {
  minWidth: 28, minHeight: 28, borderRadius: '50%',
  background: CYBER.panel, border: '1px solid ' + CYBER.border, color: CYBER.textDim,
  fontSize: 14, cursor: 'pointer', touchAction: 'manipulation',
};

function LooperStrip({ onRecord, onStop, onPlay }: { onRecord: () => void; onStop: () => void; onPlay: () => void }) {
  const looperState = useAppStore((s) => s.looperState);
  const looperTracks = useAppStore((s) => s.looperTracks);

  return (
    <div style={{
      gridColumn: '1 / -1', background: CYBER.panelAlt, borderRadius: 6,
      borderTop: '1px solid ' + CYBER.border,
      display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, fontSize: 11, color: CYBER.textDim,
    }}>
      {looperTracks.map((t) => (
        <span key={t.index} style={{
          color: t.state === 'recording' ? CYBER.primary : t.state === 'playing' ? '#2ecc71' : t.state === 'muted' ? '#555' : CYBER.textDim,
        }}>T{t.index + 1}</span>
      ))}
      <span style={{ flex: 1 }} />
      <button data-testid="bottom-looper-record" onClick={onRecord}
        style={{ ...LOOP_BTN, background: looperState === 'recording' ? CYBER.primary : CYBER.panel, color: '#eee', boxShadow: looperState === 'recording' ? '0 0 8px ' + CYBER.primaryGlow : 'none' }}>
        ⏺
      </button>
      <button data-testid="bottom-looper-stop" onClick={onStop}
        style={{ ...LOOP_BTN, color: '#eee' }}>
        ⏹
      </button>
      <button data-testid="bottom-looper-play" onClick={onPlay}
        style={{ ...LOOP_BTN, background: looperState === 'looping' ? CYBER.primary : CYBER.panel, color: looperState === 'looping' ? '#fff' : '#eee' }}>
        ▶
      </button>
    </div>
  );
}

export function Layout(props: LayoutProps) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateRows: '36px 1fr 40px',
      gridTemplateColumns: '38% 1fr 30%',
      background: CYBER.bg,
      gap: 4,
      padding: 4,
    }}>
      {/* Top bar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
        <FunctionButtons />
        <InfoBar />
      </div>

      {/* Left: Gesture Pad + Volume */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
        <div style={{ flex: 1 }}>
          <GesturePad
            onDirectionChange={props.onDirectionChange}
            onCenterTap={props.onCenterTap}
            currentLabel={props.currentModLabel}
          />
        </div>
        <VolumeSlider value={props.volume} onChange={props.onVolumeChange} />
      </div>

      {/* Center */}
      <CenterArea {...props.centerAreaProps} />

      {/* Right: Piano Keys */}
      <div style={{ padding: '0 4px' }}>
        <PianoKeys
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
          activeKeys={props.activeKeys}
          labels={props.chordLabels}
        />
      </div>

      {/* Bottom: Looper strip */}
      <LooperStrip
        onRecord={props.onLooperRecord}
        onStop={props.onLooperStop}
        onPlay={props.onLooperPlay}
      />

      <MenuOverlay />
    </div>
  );
}
