import React from 'react';

const WEEKDAY_LABELS = {
  full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  min: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

function normalizeDate(value?: Date | string | null) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function orderWeekdays(
  firstDayOfWeek: number | undefined,
  format: keyof typeof WEEKDAY_LABELS = 'short',
) {
  const start =
    typeof firstDayOfWeek === 'number' && firstDayOfWeek >= 0 && firstDayOfWeek <= 6
      ? firstDayOfWeek
      : 0;
  const labels = WEEKDAY_LABELS[format] ?? WEEKDAY_LABELS.short;
  return [...labels.slice(start), ...labels.slice(0, start)];
}

export default function MockDatePicker({
  date,
  firstDayOfWeek,
  minDate,
  onChange,
  testID,
  weekdaysFormat,
}: {
  date?: Date | string | null;
  firstDayOfWeek?: number;
  minDate?: Date | string | null;
  onChange?: ({ date }: { date: Date }) => void;
  testID?: string;
  weekdaysFormat?: keyof typeof WEEKDAY_LABELS;
}) {
  const weekdays = orderWeekdays(firstDayOfWeek, weekdaysFormat);

  return (
    <>
      {testID ? <div data-testid={`${testID}-weekdays`}>{weekdays.join(' ')}</div> : null}
      <input
        data-testid={testID}
        min={normalizeDate(minDate)}
        onChange={(event) => onChange?.({ date: new Date(`${event.target.value}T12:00:00`) })}
        type="date"
        value={normalizeDate(date)}
      />
    </>
  );
}

export function useDefaultStyles() {
  return {};
}
