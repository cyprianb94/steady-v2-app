import { describe, expect, it } from 'vitest';
import {
  firstRouteParamValue,
  parsePositiveIntegerRouteParam,
} from '../lib/route-params';

describe('route param helpers', () => {
  it('uses the first concrete Expo route param value', () => {
    expect(firstRouteParamValue('activity-1')).toBe('activity-1');
    expect(firstRouteParamValue(['session-1', 'session-2'])).toBe('session-1');
    expect(firstRouteParamValue([])).toBeNull();
    expect(firstRouteParamValue('')).toBeNull();
  });

  it('parses positive integer route params and rejects malformed values', () => {
    expect(parsePositiveIntegerRouteParam('4')).toBe(4);
    expect(parsePositiveIntegerRouteParam(['12'])).toBe(12);
    expect(parsePositiveIntegerRouteParam('0')).toBeNull();
    expect(parsePositiveIntegerRouteParam('3.5')).toBeNull();
    expect(parsePositiveIntegerRouteParam('3abc')).toBeNull();
  });
});
