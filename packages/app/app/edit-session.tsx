import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlannedSession } from '@steady/types';
import { SessionEditor } from '../components/plan-builder/SessionEditor';
import { C } from '../constants/colours';
import { FONTS } from '../constants/typography';
import { usePlan } from '../hooks/usePlan';

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseIndex(value: string | string[] | undefined): number | null {
  const raw = firstRouteParamValue(value);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default function EditSessionScreen() {
  const insets = useSafeAreaInsets();
  const { plan, loading } = usePlan();
  const params = useLocalSearchParams<{
    weekIndex?: string | string[];
    dayIndex?: string | string[];
  }>();
  const weekIndex = useMemo(() => parseIndex(params.weekIndex), [params.weekIndex]);
  const dayIndex = useMemo(() => parseIndex(params.dayIndex), [params.dayIndex]);
  const week = weekIndex != null ? plan?.weeks[weekIndex] : null;
  const existing = dayIndex != null ? week?.sessions[dayIndex] ?? null : null;
  const canEdit = Boolean(plan && week && dayIndex != null && dayIndex >= 0 && dayIndex <= 6);

  function close() {
    router.back();
  }

  function save(_: number, updated: Partial<PlannedSession> | null) {
    if (weekIndex == null || dayIndex == null) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/(tabs)/block',
      params: {
        editSessionResult: JSON.stringify({
          weekIndex,
          dayIndex,
          updated,
        }),
        editSessionNonce: String(Date.now()),
      },
    });
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ActivityIndicator color={C.clay} />
      </View>
    );
  }

  if (!canEdit || dayIndex == null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.errorTitle}>Session unavailable</Text>
        <Text style={styles.errorCopy}>Go back to the block and open this session again.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <SessionEditor
        dayIndex={dayIndex}
        existing={existing}
        onSave={save}
        onClose={close}
        presentation="screen"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: C.surface,
  },
  errorTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
    marginBottom: 8,
  },
  errorCopy: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },
});
