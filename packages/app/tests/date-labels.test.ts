import { describe, expect, it } from 'vitest';
import {
  formatDayMonthRangeLabel,
  formatDayMonthYearLabel,
  formatHomeWeekRangeLabel,
  formatIsoDayContext,
  formatShortMonthDayLabel,
} from '../lib/date-labels';

describe('date label helpers', () => {
  it('formats plan-builder and block date labels without local month arrays', () => {
    expect(formatDayMonthYearLabel('2026-09-20')).toBe('20 Sep 2026');
    expect(formatShortMonthDayLabel('2026-04-06')).toBe('Apr 6');
  });

  it('keeps the existing Home week range label shape', () => {
    expect(formatHomeWeekRangeLabel('2026-04-06')).toBe('APR 6 – 12 · 2026');
  });

  it('keeps block-volume tooltip ranges for same-month and cross-month weeks', () => {
    expect(formatDayMonthRangeLabel('2026-03-09', '2026-03-15')).toBe('9 - 15 Mar');
    expect(formatDayMonthRangeLabel('2026-03-30', '2026-04-05')).toBe('30 Mar - 5 Apr');
  });

  it('formats propagation date context and rejects malformed ISO dates', () => {
    expect(formatIsoDayContext('2026-04-07')).toEqual({
      shortLabel: 'Tue 7 Apr',
      longDay: 'Tuesday',
    });
    expect(formatIsoDayContext('2026-02-31')).toBeNull();
  });
});
