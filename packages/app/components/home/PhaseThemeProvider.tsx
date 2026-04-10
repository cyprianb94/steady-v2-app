import React, { createContext, useContext } from 'react';
import type { PhaseName } from '@steady/types';
import { getPhaseColors, type PhaseColors } from '../../lib/phase-theme';

const PhaseThemeContext = createContext<PhaseColors>(getPhaseColors('BASE'));

interface PhaseThemeProviderProps {
  phase?: PhaseName;
  children: React.ReactNode;
}

export function PhaseThemeProvider({ phase, children }: PhaseThemeProviderProps) {
  const colors = getPhaseColors(phase);
  return (
    <PhaseThemeContext.Provider value={colors}>
      {children}
    </PhaseThemeContext.Provider>
  );
}

export function usePhaseTheme(): PhaseColors {
  return useContext(PhaseThemeContext);
}
