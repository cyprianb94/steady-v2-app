export const BLOCK_RETURN_TARGET = 'block';

export function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function isBlockReturnTarget(value: string | string[] | undefined): boolean {
  return firstRouteParamValue(value) === BLOCK_RETURN_TARGET;
}

export function parseBlockWeekNumber(value: string | string[] | undefined): number | null {
  const raw = firstRouteParamValue(value);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function blockSourceParams(weekNumber: number | null | undefined): {
  returnTo: typeof BLOCK_RETURN_TARGET;
  returnWeekNumber?: string;
} {
  return weekNumber == null
    ? { returnTo: BLOCK_RETURN_TARGET }
    : { returnTo: BLOCK_RETURN_TARGET, returnWeekNumber: String(weekNumber) };
}

export function blockOpenParams(
  weekNumber: number | null | undefined,
  nonce: string = String(Date.now()),
): {
  openWeekNumber?: string;
  blockReturnNonce: string;
} {
  return weekNumber == null
    ? { blockReturnNonce: nonce }
    : { openWeekNumber: String(weekNumber), blockReturnNonce: nonce };
}

export function buildBlockOpenRoute(weekNumber: number | null | undefined) {
  return {
    pathname: '/(tabs)/block' as const,
    params: blockOpenParams(weekNumber),
  };
}
