import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { appTestHarness } from './harness';
import { AuthProvider, useAuth } from '../lib/auth';

function wrapper({ children }: React.PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  it('uses the configured preview scheme for Google OAuth redirects', async () => {
    appTestHarness.constants.expoConfig = { scheme: 'steady-preview' };
    appTestHarness.linking.createURL.mockImplementation((path = '', options?: { scheme?: string }) => {
      const normalizedPath = path.replace(/^\/+/, '');
      return `${options?.scheme ?? 'steady'}://${normalizedPath}`;
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(appTestHarness.linking.createURL).toHaveBeenCalledWith('auth/callback', {
      scheme: 'steady-preview',
    });
    expect(appTestHarness.supabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'steady-preview://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(appTestHarness.webBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://supabase.test/oauth',
      'steady-preview://auth/callback',
      { preferEphemeralSession: true },
    );
  });
});
