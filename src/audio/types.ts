export type SynthMode = 'analog' | 'fm' | 'sample' | 'noise';

export type AnalogWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle';

export type ADSRPresetName = 'LONG' | 'SHORT' | 'SWELL' | 'PLUCK' | 'TOUCH' | 'SUSTAIN';

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const ADSR_PRESETS: Record<ADSRPresetName, ADSREnvelope> = {
  LONG:    { attack: 500,  decay: 200, sustain: 0.8, release: 2000 },
  SHORT:   { attack: 10,   decay: 50,  sustain: 0.3, release: 100  },
  SWELL:   { attack: 1500, decay: 100, sustain: 0.9, release: 1000 },
  PLUCK:   { attack: 5,    decay: 300, sustain: 0.1, release: 200  },
  TOUCH:   { attack: 20,   decay: 100, sustain: 0.7, release: 300  },
  SUSTAIN: { attack: 50,   decay: 50,  sustain: 1.0, release: 500  },
};

export type EffectType =
  | 'filter' | 'reverb' | 'delay' | 'chorus' | 'flanger'
  | 'tremolo' | 'lfoVibrato' | 'glide' | 'stereo' | 'voiceCount';

export type PlayMode =
  | 'play' | 'strum' | 'lead' | 'drone' | 'arpeggio' | 'repeat'
  | 'micSample' | 'drum' | 'drumLoops' | 'autoDrum'
  | 'sequencer' | 'chordHiro' | 'earTrainer' | 'tuner' | 'mixer';

export type DrumKitName = 'tight' | 'x0x' | 'x9x' | 'lynn' | 'kr78' | 'trap' | 'user';

export type DrumSound = 'kick' | 'altKick' | 'snare' | 'closedHH' | 'tom' | 'bellRide' | 'openHH';

export type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'fingerpick';

export type ArpRate = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/16T' | '1/32' | 'swing8' | 'swing16';

export type ArpChordMode = 'arpOnly' | 'chordPlusArp' | 'rhythmPlusArp';

export type LooperState = 'off' | 'waiting' | 'recording' | 'looping';

export type StrumSpeed = 'slow' | 'medium' | 'fast';

export const STRUM_INTERVALS: Record<StrumSpeed, number> = {
  slow: 80,
  medium: 40,
  fast: 15,
};

export interface FMPreset {
  name: string;
  modulationIndex: number;
  frequencyRatio: number;
}

export const FM_PRESETS: FMPreset[] = [
  { name: 'FM EPiano', modulationIndex: 2.0, frequencyRatio: 1.0 },
  { name: 'FM HX7',    modulationIndex: 5.0, frequencyRatio: 3.5 },
  { name: 'FM Bell',   modulationIndex: 8.0, frequencyRatio: 7.0 },
  { name: 'FM Organ',  modulationIndex: 1.5, frequencyRatio: 2.0 },
  { name: 'FM Brass',  modulationIndex: 3.0, frequencyRatio: 1.0 },
];

export interface LooperTrack {
  index: number;
  state: 'empty' | 'recording' | 'playing' | 'muted';
  gain: number;
}

export interface Preset {
  id: string;
  name: string;
  synthMode: SynthMode;
  waveform: AnalogWaveform;
  fmPresetIndex: number;
  sampleName: string;
  adsr: ADSREnvelope;
  effects: Record<EffectType, { enabled: boolean; value: number }>;
  key: import('@/music/types').Key;
  scale: import('@/music/types').ScaleName;
  globalOctave: number;
  buttonOctaves: number[];
  inversions: import('@/music/types').Inversion[];
  chordLocks: import('@/music/types').ChordLock[];
  bassMode: import('@/music/types').BassMode;
  voiceLeading: boolean;
  joystickMode: import('@/music/types').JoystickMode;
  drumKit: DrumKitName;
  arpPattern: ArpPattern;
  arpRate: ArpRate;
  arpChordMode: ArpChordMode;
  bpm: number;
}
