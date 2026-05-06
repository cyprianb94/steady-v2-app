import {
  firstRouteParamValue,
  parsePositiveIntegerRouteParam,
  type RouteParamValue,
} from '../../lib/route-params';

export const BLOCK_RETURN_TARGET = 'block';

export function isBlockReturnTarget(value: RouteParamValue): boolean {
  return firstRouteParamValue(value) === BLOCK_RETURN_TARGET;
}

export function parseBlockWeekNumber(value: RouteParamValue): number | null {
  return parsePositiveIntegerRouteParam(value);
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
