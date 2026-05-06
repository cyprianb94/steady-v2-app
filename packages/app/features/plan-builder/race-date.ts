import type { DateType } from 'react-native-ui-datepicker';
import {
  formatDayMonthYearLabel,
  isoDateToLocalDate as isoDateToLocalDateValue,
  parseIsoDate as parseIsoDateValue,
} from '../../lib/date-labels';

export const parseIsoDate = parseIsoDateValue;
export const isoDateToLocalDate = isoDateToLocalDateValue;

export function formatShortDate(isoDate: string) {
  return formatDayMonthYearLabel(isoDate);
}

export function dateTypeToIsoDate(date: DateType): string | null {
  if (!date) return null;

  const normalizedDate = toDate(date);
  if (!normalizedDate || Number.isNaN(normalizedDate.getTime())) {
    return null;
  }

  return [
    normalizedDate.getFullYear(),
    String(normalizedDate.getMonth() + 1).padStart(2, '0'),
    String(normalizedDate.getDate()).padStart(2, '0'),
  ].join('-');
}

export function weeksToRace(todayIso: string, raceDate: string) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const race = new Date(`${raceDate}T00:00:00Z`);
  const diffDays = Math.ceil((race.getTime() - today.getTime()) / 86_400_000);
  return Math.max(4, Math.min(52, Math.ceil(Math.max(diffDays, 1) / 7)));
}

function toDate(value: Exclude<DateType, null | undefined>) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoDateToLocalDate(value);
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'object' && 'valueOf' in value && typeof value.valueOf === 'function') {
    return new Date(value.valueOf());
  }

  return new Date(value as string | number);
}
