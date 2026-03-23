import { C } from './colours';
import type { SessionType } from '@steady/types';

export interface SessionTypeMeta {
  color: string;
  bg: string;
  label: string;
  abbr: string;
  emoji: string;
}

export const SESSION_TYPE: Record<SessionType, SessionTypeMeta> = {
  EASY: { color: C.forest, bg: C.forestBg, label: 'Easy Run', abbr: 'E', emoji: '○' },
  INTERVAL: { color: C.clay, bg: C.clayBg, label: 'Intervals', abbr: 'I', emoji: '▲' },
  TEMPO: { color: C.amber, bg: C.amberBg, label: 'Tempo', abbr: 'T', emoji: '◆' },
  LONG: { color: C.navy, bg: C.navyBg, label: 'Long Run', abbr: 'L', emoji: '◉' },
  REST: { color: C.slate, bg: '#F2F2F4', label: 'Rest', abbr: 'R', emoji: '—' },
};
