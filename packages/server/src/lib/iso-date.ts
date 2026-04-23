function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isoDateInTimezone(value: Date | string, timezone: string): string {
  const resolved = toDate(value);

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(resolved);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to UTC ISO date if the stored timezone is invalid.
  }

  return resolved.toISOString().slice(0, 10);
}

export function currentIsoDateInTimezone(timezone: string, now: Date = new Date()): string {
  return isoDateInTimezone(now, timezone);
}
