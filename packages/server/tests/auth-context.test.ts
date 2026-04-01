import { describe, it, expect, vi } from 'vitest';
import { resolveUserId } from '../src/trpc/context';

describe('resolveUserId', () => {
  it('returns the verified user ID for a valid bearer token', async () => {
    const verifyToken = vi.fn(async (token: string) => {
      expect(token).toBe('valid-token');
      return 'user-123';
    });

    await expect(resolveUserId('Bearer valid-token', verifyToken)).resolves.toBe('user-123');
    expect(verifyToken).toHaveBeenCalledTimes(1);
  });

  it('returns null for an invalid token', async () => {
    const verifyToken = vi.fn(async () => null);

    await expect(resolveUserId('Bearer invalid-token', verifyToken)).resolves.toBeNull();
    expect(verifyToken).toHaveBeenCalledWith('invalid-token');
  });

  it('returns null and skips verification when the header is missing', async () => {
    const verifyToken = vi.fn(async () => 'should-not-run');

    await expect(resolveUserId(undefined, verifyToken)).resolves.toBeNull();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
