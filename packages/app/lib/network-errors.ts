export function isLikelyNetworkError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error);

  const normalized = message.toLowerCase();

  return (
    normalized.includes('network request failed')
    || normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('fetch failed')
    || normalized.includes('load failed')
  );
}
