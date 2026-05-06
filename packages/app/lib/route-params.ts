export type RouteParamValue = string | string[] | undefined;

export function firstRouteParamValue(value: RouteParamValue): string | null {
  if (Array.isArray(value)) {
    return value[0] && value[0].length > 0 ? value[0] : null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parsePositiveIntegerRouteParam(value: RouteParamValue): number | null {
  const raw = firstRouteParamValue(value);
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeIntegerRouteParam(value: RouteParamValue): number | null {
  const raw = firstRouteParamValue(value);
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
