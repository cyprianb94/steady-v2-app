import { describe, it, expect } from 'vitest';
import { paceToSeconds, secondsToPace } from '../src/lib/pace-utils';

describe('paceToSeconds', () => {
  it('converts 4:20 to 260', () => {
    expect(paceToSeconds('4:20')).toBe(260);
  });

  it('converts 5:00 to 300', () => {
    expect(paceToSeconds('5:00')).toBe(300);
  });

  it('converts 3:50 to 230', () => {
    expect(paceToSeconds('3:50')).toBe(230);
  });
});

describe('secondsToPace', () => {
  it('converts 260 to 4:20', () => {
    expect(secondsToPace(260)).toBe('4:20');
  });

  it('zero-pads single digit seconds: 245 → 4:05', () => {
    expect(secondsToPace(245)).toBe('4:05');
  });

  it('converts 300 to 5:00', () => {
    expect(secondsToPace(300)).toBe('5:00');
  });
});

describe('round-trip', () => {
  it.each(['3:00', '3:50', '4:05', '4:20', '5:30', '6:45', '7:00'])(
    'secondsToPace(paceToSeconds("%s")) === "%s"',
    (pace) => {
      expect(secondsToPace(paceToSeconds(pace))).toBe(pace);
    }
  );
});
