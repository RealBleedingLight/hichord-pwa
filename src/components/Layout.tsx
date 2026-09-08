// src/components/Layout.tsx
import { FunctionButtons } from './FunctionButtons';
import { InfoBar } from './InfoBar';
import { GesturePad } from './GesturePad';
import { PianoKeys } from './PianoKeys';
import { VolumeSlider } from './VolumeSlider';
import { CenterArea } from './CenterArea';
import type { ScaleDegree, JoystickDirection } from '@/music/types';

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
}

export function Layout(props: LayoutProps) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateRows: '36px 1fr 40px',
      gridTemplateColumns: '38% 1fr 30%',
      background: '#1a1a2e',
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
      <CenterArea />

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
      <div style={{
        gridColumn: '1 / -1',
        background: '#16213e',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        fontSize: 11,
        color: '#668',
      }}>
        {[1, 2, 3, 4, 5, 6].map((t) => (
          <span key={t}>T{t} ░░░░</span>
        ))}
        <span style={{ marginLeft: 'auto' }}>⏺ ⏹ ▶</span>
      </div>
    </div>
  );
}
