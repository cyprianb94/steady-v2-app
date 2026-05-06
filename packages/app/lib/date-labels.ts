import { addDaysIso } from '@steady/types';

export const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const WEEKDAY_SHORT_LABELS_SUNDAY_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG_LABELS_MONDAY_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEKDAY_LONG_LABELS_SUNDAY_FIRST = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface IsoDateParts {
  year: number;
  monthIndex: number;
  day: number;
}

export interface IsoDayContext {
  shortLabel: string;
  longDay: string;
}

export function parseIsoDate(isoDate: string): IsoDateParts {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

export function isoDateToLocalDate(isoDate: string): Date {
  const { year, monthIndex, day } = parseIsoDate(isoDate);
  return new Date(year, monthIndex, day);
}

function validUtcDateFromIso(isoDate: string): Date | null {
  const { year, monthIndex, day } = parseIsoDate(isoDate);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const value = new Date(Date.UTC(year, monthIndex, day));
  if (
    Number.isNaN(value.getTime()) ||
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== monthIndex ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

export function formatDayMonthYearLabel(isoDate: string): string {
  const { year, monthIndex, day } = parseIsoDate(isoDate);
  return `${day} ${MONTH_SHORT_LABELS[monthIndex]} ${year}`;
}

export function formatShortMonthDayLabel(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '';
  }

  const value = validUtcDateFromIso(isoDate);
  if (!value) {
    return '';
  }

  return `${MONTH_SHORT_LABELS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

export function formatUpperMonthDayLabel(isoDate: string): string {
  const value = validUtcDateFromIso(isoDate);
  if (!value) {
    return '';
  }

  return `${MONTH_SHORT_LABELS[value.getUTCMonth()].toUpperCase()} ${value.getUTCDate()}`;
}

export function formatRaceDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '';
  }

  const value = validUtcDateFromIso(isoDate);
  if (!value) {
    return '';
  }

  return `${MONTH_SHORT_LABELS[value.getUTCMonth()]} ${value.getUTCDate()}, ${value.getUTCFullYear()}`;
}

export function formatHomeWeekRangeLabel(weekStartDate: string): string {
  const start = validUtcDateFromIso(weekStartDate);
  const weekEndDate = addDaysIso(weekStartDate, 6);
  const end = validUtcDateFromIso(weekEndDate);
  if (!start || !end) {
    return '';
  }

  return `${MONTH_SHORT_LABELS[start.getUTCMonth()].toUpperCase()} ${start.getUTCDate()} – ${end.getUTCDate()} · ${end.getUTCFullYear()}`;
}

export function formatDayMonthRangeLabel(startIso: string, endIso: string): string {
  const start = validUtcDateFromIso(startIso);
  const end = validUtcDateFromIso(endIso);
  if (!start || !end) {
    return '';
  }

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTH_SHORT_LABELS[start.getUTCMonth()];
  const endMonth = MONTH_SHORT_LABELS[end.getUTCMonth()];

  return startMonth === endMonth
    ? `${startDay} - ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

export function formatIsoWeekDateRangeLabel(startIso: string): string {
  return formatDayMonthRangeLabel(startIso, addDaysIso(startIso, 6));
}

export function formatIsoDayContext(isoDate: string | null | undefined): IsoDayContext | null {
  if (!isoDate) {
    return null;
  }

  const value = validUtcDateFromIso(isoDate);
  if (!value) {
    return null;
  }

  const weekday = value.getUTCDay();
  return {
    shortLabel: `${WEEKDAY_SHORT_LABELS_SUNDAY_FIRST[weekday]} ${value.getUTCDate()} ${MONTH_SHORT_LABELS[value.getUTCMonth()]}`,
    longDay: WEEKDAY_LONG_LABELS_SUNDAY_FIRST[weekday],
  };
}

export function formatRunDetailMetaLabel(startTime: string): string {
  const value = new Date(startTime);
  const weekday = value.toLocaleDateString([], { weekday: 'short' });
  const monthDay = value.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${monthDay} · ${time}`;
}

export function formatActivityListTimeLabel(startTime: string): string {
  const value = new Date(startTime);
  const time = value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const label = value.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${label}, ${time}`;
}
