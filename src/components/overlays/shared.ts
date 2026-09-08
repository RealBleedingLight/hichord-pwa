// src/components/overlays/shared.ts
// Shared style helpers for overlay panels (Task 12).
import type { CSSProperties } from 'react';

export const sectionLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#667',
  letterSpacing: 0.5,
  marginBottom: 4,
  textTransform: 'uppercase',
};

export const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};

export const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

export function chipStyle(active: boolean, accent: string): CSSProperties {
  return {
    minWidth: 32,
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: active ? accent : '#0f1626',
    color: active ? '#111' : '#cdd',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  };
}

export function stepperButtonStyle(): CSSProperties {
  return {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 6,
    border: 'none',
    background: '#0f1626',
    color: '#cdd',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    touchAction: 'manipulation',
  };
}

export const panelStyle: CSSProperties = {
  width: '100%',
  padding: 12,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

export const toggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const sliderStyle: CSSProperties = {
  flex: 1,
  minWidth: 80,
  touchAction: 'none',
};
