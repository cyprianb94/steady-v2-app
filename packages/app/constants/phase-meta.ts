import { C } from './colours';
import type { PhaseName } from '@steady/types';

export const PHASE_COLOR: Record<PhaseName, string> = {
  BASE: C.navy,
  BUILD: C.clay,
  RECOVERY: '#7C5CBF',
  PEAK: C.amber,
  TAPER: C.forest,
};
