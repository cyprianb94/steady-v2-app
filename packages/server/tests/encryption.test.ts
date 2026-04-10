import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/lib/encryption';

describe('encryption', () => {
  it('round-trips plaintext with the same key', () => {
    const ciphertext = encrypt('refresh-token-123', 'test-key');

    expect(ciphertext).not.toBe('refresh-token-123');
    expect(decrypt(ciphertext, 'test-key')).toBe('refresh-token-123');
  });

  it('produces different ciphertext for different keys', () => {
    const plaintext = 'access-token-abc';

    const encryptedWithFirstKey = encrypt(plaintext, 'first-key');
    const encryptedWithSecondKey = encrypt(plaintext, 'second-key');

    expect(encryptedWithFirstKey).not.toBe(encryptedWithSecondKey);
  });
});
