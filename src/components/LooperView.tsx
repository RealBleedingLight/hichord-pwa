// src/components/LooperView.tsx
import { useAppStore } from '@/store';
import { CYBER } from '@/theme';

const ACCENT = CYBER.primary;

const STATE_COLORS: Record<string, string> = {
  empty: '#1a0808',
  recording: CYBER.primary,
  playing: '#1f6b3f',
  muted: '#3a3a3a',
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
  onTrackClear?: (trackIndex: number) => void;
  onClearAll?: () => void;
  /** Downloads the loop mix as a WAV, repeated n times. */
  onExport?: (repeats: number) => void;
}

const MIX_CHANNELS: { key: 'synth' | 'beat' | 'loops'; label: string }[] = [
  { key: 'synth', label: 'SYNTH' },
  { key: 'beat', label: 'BEAT' },
  { key: 'loops', label: 'LOOPS' },
];

export function LooperView({ onRecordToggle, onStop, onPlayToggle, onTrackMuteToggle, onTrackClear, onClearAll, onExport }: LooperViewProps) {
  const mix = useAppStore((s) => s.mix);
  const setMix = useAppStore((s) => s.setMix);
  const bpm = useAppStore((s) => s.bpm);
  const looperTracks = useAppStore((s) => s.looperTracks);
  const activeTrack = useAppStore((s) => s.activeTrack);
  const setActiveTrack = useAppStore((s) => s.setActiveTrack);
  const looperState = useAppStore((s) => s.looperState);
  const looperBars = useAppStore((s) => s.looperBars);
  const setLooperBars = useAppStore((s) => s.setLooperBars);
  const looperPhase = useAppStore((s) => s.looperPhase);
  const metronomeOn = useAppStore((s) => s.metronomeOn);
  const setMetronome = useAppStore((s) => s.setMetronome);
  const hasAudio = looperTracks.some((t) => t.state === 'playing' || t.state === 'muted');

  const small: React.CSSProperties = {
    minWidth: 30, minHeight: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, touchAction: 'manipulation',
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 5, padding: 8, overflow: 'auto',
      background: CYBER.panel, border: '1px solid ' + CYBER.border, borderRadius: 8,
    }}>
      <div style={{ fontSize: 10, color: CYBER.textDim, lineHeight: 1.3 }}>
        {hasAudio
          ? `New tracks record one full loop and stay in sync. Tempo is locked at ${bpm} BPM while loops exist. Loops are saved on this device.`
          : `The first recording sets the loop length (${looperBars} bar${looperBars > 1 ? 's' : ''}). ${metronomeOn ? '1 bar count-in.' : ''}`}
      </div>
      <div style={{ height: 4, background: '#2a1010', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${looperState === 'off' ? 0 : looperPhase * 100}%`, height: '100%', background: CYBER.green }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {looperTracks.map((track) => (
          <div
            key={track.index}
            data-testid={`looper-track-${track.index}`}
            role="button"
            onClick={() => setActiveTrack(track.index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 30,
              padding: '1px 6px',
              borderRadius: 6,
              border: activeTrack === track.index ? `2px solid ${ACCENT}` : '2px solid transparent',
              background: STATE_COLORS[track.state] ?? '#1a0808',
              color: '#eee',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ width: 28 }}>T{track.index + 1}</span>
            <span data-testid={`looper-track-state-${track.index}`} style={{ flex: 1, fontSize: 11, opacity: 0.85 }}>
              {STATE_LABELS[track.state] ?? track.state}
            </span>
            {onTrackMuteToggle && track.state !== 'empty' && track.state !== 'recording' && (
              <button
                data-testid={`looper-track-mute-${track.index}`}
                aria-label={track.state === 'muted' ? `Unmute track ${track.index + 1}` : `Mute track ${track.index + 1}`}
                onClick={(e) => { e.stopPropagation(); onTrackMuteToggle(track.index); }}
                style={{ ...small, background: 'rgba(0,0,0,.3)', color: '#eee' }}
              >
                {track.state === 'muted' ? '🔇' : '🔊'}
              </button>
            )}
            {onTrackClear && track.state !== 'empty' && track.state !== 'recording' && (
              <button
                data-testid={`looper-track-clear-${track.index}`}
                aria-label={`Clear track ${track.index + 1}`}
                onClick={(e) => { e.stopPropagation(); onTrackClear(track.index); }}
                style={{ ...small, background: 'rgba(0,0,0,.3)', color: '#eee' }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <button
          data-testid="looper-record"
          aria-label="Record"
          onClick={() => onRecordToggle(activeTrack)}
          style={{
            minWidth: 38, minHeight: 38, borderRadius: '50%', border: 'none',
            background: looperState === 'recording' || looperState === 'waiting' ? CYBER.primary : '#1a0808',
            color: looperState === 'recording' || looperState === 'waiting' ? '#fff' : CYBER.primary,
            fontSize: 18, cursor: 'pointer',
          }}
        >
          ●
        </button>
        <button
          data-testid="looper-play"
          aria-label="Play"
          onClick={onPlayToggle}
          style={{
            minWidth: 38, minHeight: 38, borderRadius: 8, border: 'none',
            background: looperState === 'looping' ? CYBER.green : '#1a0808',
            color: looperState === 'looping' ? '#111' : '#eee',
            fontSize: 18, cursor: 'pointer',
          }}
        >
          ▶
        </button>
        <button
          data-testid="looper-stop"
          aria-label="Stop"
          onClick={onStop}
          style={{ minWidth: 38, minHeight: 38, borderRadius: 8, border: 'none', background: '#1a0808', color: '#eee', fontSize: 18, cursor: 'pointer' }}
        >
          ■
        </button>
        {onClearAll && (
          <button onClick={onClearAll} disabled={!hasAudio} style={{ ...small, padding: '0 10px', background: '#1a0808', color: hasAudio ? CYBER.textMid : '#555' }}>
            CLEAR ALL
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: CYBER.textDim }}>BARS</span>
        {[1, 2, 4, 8].map((n) => (
          <button
            key={n}
            data-testid={`looper-bars-${n}`}
            onClick={() => setLooperBars(n)}
            disabled={hasAudio}
            title={hasAudio ? 'Clear all tracks to change the loop length' : ''}
            style={{
              ...small,
              background: looperBars === n ? ACCENT : '#1a0808',
              color: looperBars === n ? '#111' : hasAudio ? '#555' : CYBER.textLight,
            }}
          >
            {n}
          </button>
        ))}
        <span style={{ width: 10 }} />
        {onExport && (
          <>
            <button data-testid="export-wav" onClick={() => onExport(1)} disabled={!hasAudio}
              style={{ ...small, padding: '0 10px', background: '#1a0808', color: hasAudio ? CYBER.secondary : '#555' }}>
              ⤓ WAV
            </button>
            <button onClick={() => onExport(4)} disabled={!hasAudio}
              style={{ ...small, padding: '0 10px', background: '#1a0808', color: hasAudio ? CYBER.secondary : '#555' }}>
              ⤓ ×4
            </button>
          </>
        )}
        <button
          onClick={() => setMetronome(!metronomeOn)}
          aria-pressed={metronomeOn}
          style={{ ...small, padding: '0 10px', background: metronomeOn ? CYBER.amber : '#1a0808', color: metronomeOn ? '#000' : CYBER.textMid }}
        >
          CLICK {metronomeOn ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 10 }}>
        {MIX_CHANNELS.map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2, color: CYBER.textDim, letterSpacing: 1 }}>
            <span>{label} <span style={{ color: CYBER.textLight }}>{Math.round(mix[key] * 100)}%</span></span>
            <input
              type="range" min={0} max={1.5} step={0.01} value={mix[key]}
              aria-label={`${label} level`}
              onChange={(e) => setMix(key, parseFloat(e.target.value))}
              style={{ width: '100%', touchAction: 'none', margin: 0 }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
