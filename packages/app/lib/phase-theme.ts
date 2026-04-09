import type { PhaseName } from '@steady/types';

export interface PhaseColors {
  surface: string;
  accent: string;
  border: string;
  badge: string;
  badgeText: string;
}

const PHASE_COLORS: Record<PhaseName, PhaseColors> = {
  BASE: {
    surface: '#F4EFE6',    // cream — warm neutral
    accent: '#C4522A',     // clay
    border: '#E5DDD0',
    badge: '#FDF0EB',
    badgeText: '#C4522A',
  },
  BUILD: {
    surface: '#F2ECE0',    // slightly warmer/denser
    accent: '#D4882A',     // amber — heat & intensity
    border: '#E0D6C5',
    badge: '#FDF6EB',
    badgeText: '#D4882A',
  },
  RECOVERY: {
    surface: '#EEF4F1',    // cool green tint
    accent: '#2A5C45',     // forest — calm & healing
    border: '#D5E5DC',
    badge: '#EEF4F1',
    badgeText: '#2A5C45',
  },
  PEAK: {
    surface: '#EDF1F8',    // cool blue tint
    accent: '#1B3A6B',     // navy — sharp & focused
    border: '#D2DBE8',
    badge: '#EDF1F8',
    badgeText: '#1B3A6B',
  },
  TAPER: {
    surface: '#F7F3EE',    // light cream — airy, calm
    accent: '#8A8E9A',     // slate — subdued
    border: '#E8E4DD',
    badge: '#F0EEE9',
    badgeText: '#6B6F7A',
  },
};

export function getPhaseColors(phase?: PhaseName): PhaseColors {
  return PHASE_COLORS[phase ?? 'BASE'];
}
