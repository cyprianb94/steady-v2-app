import { createContext, useContext } from 'react';
import type { User } from '@steady/types';

export type Units = User['units'];

export interface PreferencesContextValue {
  units: Units;
  loading: boolean;
  updatingUnits: boolean;
  setUnits: (units: Units) => Promise<void>;
}

export const PreferencesContext = createContext<PreferencesContextValue>({
  units: 'metric',
  loading: false,
  updatingUnits: false,
  setUnits: async () => {},
});

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
