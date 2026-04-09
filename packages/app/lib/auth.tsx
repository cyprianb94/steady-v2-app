import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { requireSupabaseClient, getSupabaseClient } from './supabase';
import { setCurrentSession } from './auth-session';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  signInWithGoogle: () => Promise<Session | null>;
  signOut: () => Promise<void>;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getRedirectTo() {
  const isExpoGo = Constants.appOwnership === 'expo';
  return isExpoGo
    ? makeRedirectUri({ path: 'auth/callback' })
    : makeRedirectUri({ scheme: 'steady', path: 'auth/callback' });
}

async function createSessionFromUrl(url: string): Promise<Session | null> {
  const supabase = requireSupabaseClient();
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;
  return data.session;
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const url = Linking.useLinkingURL();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCurrentSession(null);
      setSession(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setCurrentSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_OUT'
      ) {
        setSession(nextSession);
        setCurrentSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    createSessionFromUrl(url)
      .then((nextSession) => {
        setSession(nextSession);
        setCurrentSession(nextSession);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [url]);

  async function signInWithGoogle(): Promise<Session | null> {
    setIsLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const redirectTo = getRedirectTo();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error('Supabase did not return an OAuth URL');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setIsLoading(false);
        return null;
      }

      const nextSession = await createSessionFromUrl(result.url);
      setSession(nextSession);
      setCurrentSession(nextSession);
      setIsLoading(false);
      return nextSession;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }

  async function signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCurrentSession(null);
      setSession(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsLoading(false);
      throw error;
    }

    setCurrentSession(null);
    setSession(null);
    setIsLoading(false);
  }

  return (
    <AuthContext.Provider value={{ signInWithGoogle, signOut, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
}
