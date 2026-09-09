import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Preset } from '@/audio/types';

const DB_NAME = 'hichord-db';
const DB_VERSION = 1;

const PRESETS_STORE = 'presets';
const SAMPLES_STORE = 'samples';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'app-settings';

const REQUIRED_PRESET_FIELDS: (keyof Preset)[] = [
  'id', 'name', 'synthMode', 'waveform', 'fmPresetIndex', 'sampleName',
  'adsr', 'effects', 'key', 'scale', 'globalOctave', 'buttonOctaves',
  'inversions', 'chordLocks', 'bassMode', 'voiceLeading', 'joystickMode',
  'drumKit', 'arpPattern', 'arpRate', 'arpChordMode', 'bpm',
];

/**
 * Serializes a Preset to a JSON string for export/sharing.
 */
export function exportPreset(preset: Preset): string {
  return JSON.stringify(preset);
}

/**
 * Deserializes a JSON string back into a Preset, validating that all
 * required fields are present. Throws if the JSON is malformed or the
 * resulting object is not a valid Preset.
 */
export function importPreset(json: string): Preset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('importPreset: invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('importPreset: preset must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  for (const field of REQUIRED_PRESET_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`importPreset: missing required field "${field}"`);
    }
  }

  return obj as unknown as Preset;
}

interface HiChordDBSchema extends DBSchema {
  presets: {
    key: string;
    value: Preset;
  };
  samples: {
    key: string;
    value: { name: string; data: ArrayBuffer };
  };
  settings: {
    key: string;
    value: object;
  };
}

/**
 * Wraps IndexedDB access (via `idb`) for presets, mic samples, and app
 * settings. A single database with three object stores.
 */
export class HiChordDB {
  private dbPromise: Promise<IDBPDatabase<HiChordDBSchema>>;

  constructor() {
    this.dbPromise = openDB<HiChordDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PRESETS_STORE)) {
          db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SAMPLES_STORE)) {
          db.createObjectStore(SAMPLES_STORE, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      },
    });
  }

  async savePreset(preset: Preset): Promise<void> {
    const db = await this.dbPromise;
    await db.put(PRESETS_STORE, preset);
  }

  async loadPreset(id: string): Promise<Preset> {
    const db = await this.dbPromise;
    const preset = await db.get(PRESETS_STORE, id);
    if (!preset) {
      throw new Error(`loadPreset: no preset found with id "${id}"`);
    }
    return preset;
  }

  async listPresets(): Promise<Preset[]> {
    const db = await this.dbPromise;
    return db.getAll(PRESETS_STORE);
  }

  async deletePreset(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(PRESETS_STORE, id);
  }

  async saveSample(name: string, data: ArrayBuffer): Promise<void> {
    const db = await this.dbPromise;
    await db.put(SAMPLES_STORE, { name, data });
  }

  async loadSample(name: string): Promise<ArrayBuffer> {
    const db = await this.dbPromise;
    const sample = await db.get(SAMPLES_STORE, name);
    if (!sample) {
      throw new Error(`loadSample: no sample found with name "${name}"`);
    }
    return sample.data;
  }

  async saveSettings(settings: object): Promise<void> {
    const db = await this.dbPromise;
    await db.put(SETTINGS_STORE, settings, SETTINGS_KEY);
  }

  async loadSettings(): Promise<object> {
    const db = await this.dbPromise;
    const settings = await db.get(SETTINGS_STORE, SETTINGS_KEY);
    return settings ?? {};
  }

  exportPreset(preset: Preset): string {
    return exportPreset(preset);
  }

  importPreset(json: string): Preset {
    return importPreset(json);
  }
}
