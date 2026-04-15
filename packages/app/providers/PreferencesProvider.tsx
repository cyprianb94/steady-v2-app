import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import { PreferencesContext, type Units } from './preferences-context';

const UNITS_STORAGE_KEY = 'steady.preferences.units';

function isUnits(value: string | null): value is Units {
  return value === 'metric' || value === 'imperial';
}

export function PreferencesProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const [units, setUnitsState] = useState<Units>('metric');
  const [loading, setLoading] = useState(false);
  const [updatingUnits, setUpdatingUnits] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      let cachedUnits: Units | null = null;

      try {
        setLoading(true);
        const storedUnits = await AsyncStorage.getItem(UNITS_STORAGE_KEY);
        if (isUnits(storedUnits)) {
          cachedUnits = storedUnits;
          if (!cancelled) {
            setUnitsState(storedUnits);
          }
        }
      } catch {
        // Storage read failures should not block app startup.
      }

      if (!session?.user?.id) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const { trpc } = await import('../lib/trpc');
        const profile = await trpc.profile.me.query();
        if (!cancelled) {
          setUnitsState(profile.units);
        }
        await AsyncStorage.setItem(UNITS_STORAGE_KEY, profile.units);
      } catch (error) {
        if (!isLikelyNetworkError(error)) {
          console.log('Preferences bootstrap failed:', error);
        }
        if (!cancelled && !cachedUnits) {
          setUnitsState('metric');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPreferences().catch((error) => {
      if (!isLikelyNetworkError(error)) {
        console.log('Preferences initialization failed:', error);
      }
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const setUnits = useCallback(async (nextUnits: Units) => {
    const previousUnits = units;
    setUnitsState(nextUnits);
    await AsyncStorage.setItem(UNITS_STORAGE_KEY, nextUnits);

    if (!session?.user?.id) {
      return;
    }

    try {
      setUpdatingUnits(true);
      const { trpc } = await import('../lib/trpc');
      const profile = await trpc.profile.updatePreferences.mutate({ units: nextUnits });
      setUnitsState(profile.units);
      await AsyncStorage.setItem(UNITS_STORAGE_KEY, profile.units);
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        setUnitsState(previousUnits);
        await AsyncStorage.setItem(UNITS_STORAGE_KEY, previousUnits);
        throw error;
      }
    } finally {
      setUpdatingUnits(false);
    }
  }, [session?.user?.id, units]);

  const value = useMemo(
    () => ({
      units,
      loading,
      updatingUnits,
      setUnits,
    }),
    [loading, setUnits, units, updatingUnits],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
