// src/components/LooperView.tsx
import { useAppStore } from '@/store';

const ACCENT = '#4a9eff';

const STATE_COLORS: Record<string, string> = {
  empty: '#0f1626',
  recording: '#e04040',
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
              background: STATE_COLORS[track.state] ?? '#0f1626',
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
              <span
                role="button"
                data-testid={`looper-track-mute-${track.index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackMuteToggle(track.index);
                }}
                style={{ fontSize: 10, opacity: 0.8 }}
              >
                {track.state === 'muted' ? '🔇' : '🔊'}
              </span>
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
            background: looperState === 'recording' ? '#e04040' : '#0f1626',
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
            background: '#0f1626',
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
            background: looperState === 'looping' ? ACCENT : '#0f1626',
            color: looperState === 'looping' ? '#111' : '#eee',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ▶
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#667' }}>BARS</span>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            data-testid={`looper-bars-${n}`}
            onClick={() => setLooperBars(n)}
            style={{
              minWidth: 28,
              minHeight: 28,
              borderRadius: 6,
              border: 'none',
              background: looperBars === n ? ACCENT : '#0f1626',
              color: looperBars === n ? '#111' : '#cdd',
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
