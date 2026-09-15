// src/components/LooperView.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;

const STATE_COLORS: Record<string, string> = {
  empty: '#1a0808',
  recording: CYBER.primary,
  playing: '#2ecc71',
  muted: '#555',
};

const STATE_LABELS: Record<string, string> = {
  empty: 'EMPTY',
  recording: 'REC',
  playing: 'PLAY',
  muted: 'MUTE',
};

export interface LooperViewProps {
  onRecordToggle: (trackIndex: number) => void;
  onStop: () => void;
  onPlayToggle: () => void;
  onTrackMuteToggle?: (trackIndex: number) => void;
}

export function LooperView({ onRecordToggle, onStop, onPlayToggle, onTrackMuteToggle }: LooperViewProps) {
  const looperTracks = useAppStore((s) => s.looperTracks);
  const activeTrack = useAppStore((s) => s.activeTrack);
  const setActiveTrack = useAppStore((s) => s.setActiveTrack);
  const looperState = useAppStore((s) => s.looperState);
  const looperBars = useAppStore((s) => s.looperBars);
  const setLooperBars = useAppStore((s) => s.setLooperBars);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {looperTracks.map((track) => (
          <button
            key={track.index}
            data-testid={`looper-track-${track.index}`}
            onClick={() => setActiveTrack(track.index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 32,
              padding: '4px 10px',
              borderRadius: 6,
              border: activeTrack === track.index ? `2px solid ${ACCENT}` : '2px solid transparent',
              background: STATE_COLORS[track.state] ?? '#1a0808',
              color: '#eee',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <span>T{track.index + 1}</span>
            <span data-testid={`looper-track-state-${track.index}`}>{STATE_LABELS[track.state] ?? track.state}</span>
            {onTrackMuteToggle && (
              <button
                data-testid={`looper-track-mute-${track.index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackMuteToggle(track.index);
                }}
                style={{ minWidth: 32, minHeight: 32, background: 'transparent', border: 'none', color: '#eee', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                {track.state === 'muted' ? '🔇' : '🔊'}
              </button>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <button
          data-testid="looper-record"
          onClick={() => onRecordToggle(activeTrack)}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: '50%',
            border: 'none',
            background: looperState === 'recording' ? CYBER.primary : '#1a0808',
            color: '#eee',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ⏺
        </button>
        <button
          data-testid="looper-stop"
          onClick={onStop}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 8,
            border: 'none',
            background: '#1a0808',
            color: '#eee',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ⏹
        </button>
        <button
          data-testid="looper-play"
          onClick={onPlayToggle}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 8,
            border: 'none',
            background: looperState === 'looping' ? ACCENT : '#1a0808',
            color: looperState === 'looping' ? '#111' : '#eee',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ▶
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: CYBER.textDim }}>BARS</span>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            data-testid={`looper-bars-${n}`}
            onClick={() => setLooperBars(n)}
            style={{
              minWidth: 32,
              minHeight: 32,
              borderRadius: 6,
              border: 'none',
              background: looperBars === n ? ACCENT : '#1a0808',
              color: looperBars === n ? '#111' : CYBER.textLight,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
