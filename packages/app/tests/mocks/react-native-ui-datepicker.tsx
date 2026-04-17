import React from 'react';

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

export default function MockDatePicker({
  date,
  minDate,
  onChange,
  testID,
}: {
  date?: Date | string | null;
  minDate?: Date | string | null;
  onChange?: ({ date }: { date: Date }) => void;
  testID?: string;
}) {
  return (
    <input
      data-testid={testID}
      min={normalizeDate(minDate)}
      onChange={(event) => onChange?.({ date: new Date(`${event.target.value}T12:00:00`) })}
      type="date"
      value={normalizeDate(date)}
    />
  );
}

export function useDefaultStyles() {
  return {};
}
