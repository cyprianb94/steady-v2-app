import { createContext, useContext } from 'react';
import type { User, WeeklyVolumeMetric } from '@steady/types';

export type Units = User['units'];

export interface PreferencesContextValue {
  units: Units;
  weeklyVolumeMetric: WeeklyVolumeMetric;
  loading: boolean;
  updatingUnits: boolean;
  updatingWeeklyVolumeMetric: boolean;
  setUnits: (units: Units) => Promise<void>;
  setWeeklyVolumeMetric: (metric: WeeklyVolumeMetric) => Promise<void>;
}

export const PreferencesContext = createContext<PreferencesContextValue>({
  units: 'metric',
  weeklyVolumeMetric: 'distance',
  loading: false,
  updatingUnits: false,
  updatingWeeklyVolumeMetric: false,
  setUnits: async () => {},
  setWeeklyVolumeMetric: async () => {},
});

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
