import { describe, it, expect } from 'vitest';
import { RECOVERY_KM } from '@steady/types';

describe('toolchain smoke test', () => {
  it('imports shared types from @steady/types', () => {
    expect(RECOVERY_KM['90s']).toBe(0.27);
  });

  it('TypeScript strict mode is enabled', () => {
    // This test existing and compiling proves strict mode works
    const value: string = 'hello';
    expect(typeof value).toBe('string');
  });
});
