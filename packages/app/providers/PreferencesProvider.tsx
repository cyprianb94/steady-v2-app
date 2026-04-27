import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import {
  PreferencesContext,
  type Units,
  type PreferencesContextValue,
} from './preferences-context';
import type { WeeklyVolumeMetric } from '@steady/types';
import { isScreenshotDemoMode } from '../demo/screenshot-demo';

const UNITS_STORAGE_KEY = 'steady.preferences.units';
const WEEKLY_VOLUME_METRIC_STORAGE_KEY = 'steady.preferences.weeklyVolumeMetric';

function isUnits(value: string | null): value is Units {
  return value === 'metric' || value === 'imperial';
}

function isWeeklyVolumeMetric(value: string | null): value is WeeklyVolumeMetric {
  return value === 'time' || value === 'distance';
}

export function PreferencesProvider({ children }: React.PropsWithChildren) {
  if (isScreenshotDemoMode()) {
    return (
      <PreferencesContext.Provider
        value={{
          units: 'metric',
          weeklyVolumeMetric: 'distance',
          loading: false,
          updatingUnits: false,
          updatingWeeklyVolumeMetric: false,
          setUnits: async () => {},
          setWeeklyVolumeMetric: async () => {},
        }}
      >
        {children}
      </PreferencesContext.Provider>
    );
  }

  const { session } = useAuth();
  const [units, setUnitsState] = useState<Units>('metric');
  const [weeklyVolumeMetric, setWeeklyVolumeMetricState] = useState<WeeklyVolumeMetric>('distance');
  const [loading, setLoading] = useState(false);
  const [updatingUnits, setUpdatingUnits] = useState(false);
  const [updatingWeeklyVolumeMetric, setUpdatingWeeklyVolumeMetric] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      let cachedUnits: Units | null = null;
      let cachedWeeklyVolumeMetric: WeeklyVolumeMetric | null = null;

      try {
        setLoading(true);
        const [storedUnits, storedWeeklyVolumeMetric] = await Promise.all([
          AsyncStorage.getItem(UNITS_STORAGE_KEY),
          AsyncStorage.getItem(WEEKLY_VOLUME_METRIC_STORAGE_KEY),
        ]);
        if (isUnits(storedUnits)) {
          cachedUnits = storedUnits;
          if (!cancelled) {
            setUnitsState(storedUnits);
          }
        }
        if (isWeeklyVolumeMetric(storedWeeklyVolumeMetric)) {
          cachedWeeklyVolumeMetric = storedWeeklyVolumeMetric;
          if (!cancelled) {
            setWeeklyVolumeMetricState(storedWeeklyVolumeMetric);
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
          setWeeklyVolumeMetricState(profile.weeklyVolumeMetric);
        }
        await Promise.all([
          AsyncStorage.setItem(UNITS_STORAGE_KEY, profile.units),
          AsyncStorage.setItem(WEEKLY_VOLUME_METRIC_STORAGE_KEY, profile.weeklyVolumeMetric),
        ]);
      } catch (error) {
        if (!isLikelyNetworkError(error)) {
          console.log('Preferences bootstrap failed:', error);
        }
        if (!cancelled && !cachedUnits) {
          setUnitsState('metric');
        }
        if (!cancelled && !cachedWeeklyVolumeMetric) {
          setWeeklyVolumeMetricState('distance');
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

  const setWeeklyVolumeMetric = useCallback(async (nextMetric: WeeklyVolumeMetric) => {
    const previousMetric = weeklyVolumeMetric;
    setWeeklyVolumeMetricState(nextMetric);
    await AsyncStorage.setItem(WEEKLY_VOLUME_METRIC_STORAGE_KEY, nextMetric);

    if (!session?.user?.id) {
      return;
    }

    try {
      setUpdatingWeeklyVolumeMetric(true);
      const { trpc } = await import('../lib/trpc');
      const profile = await trpc.profile.updatePreferences.mutate({ weeklyVolumeMetric: nextMetric });
      setWeeklyVolumeMetricState(profile.weeklyVolumeMetric);
      await AsyncStorage.setItem(WEEKLY_VOLUME_METRIC_STORAGE_KEY, profile.weeklyVolumeMetric);
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        setWeeklyVolumeMetricState(previousMetric);
        await AsyncStorage.setItem(WEEKLY_VOLUME_METRIC_STORAGE_KEY, previousMetric);
        throw error;
      }
    } finally {
      setUpdatingWeeklyVolumeMetric(false);
    }
  }, [session?.user?.id, weeklyVolumeMetric]);

  const value: PreferencesContextValue = useMemo(
    () => ({
      units,
      weeklyVolumeMetric,
      loading,
      updatingUnits,
      updatingWeeklyVolumeMetric,
      setUnits,
      setWeeklyVolumeMetric,
    }),
    [
      loading,
      setUnits,
      setWeeklyVolumeMetric,
      units,
      updatingUnits,
      updatingWeeklyVolumeMetric,
      weeklyVolumeMetric,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
