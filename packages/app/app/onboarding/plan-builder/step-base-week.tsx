import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StarterChoiceCards } from '../../../components/plan-builder/StarterChoiceCards';
import { Btn } from '../../../components/ui/Btn';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import {
  DEFAULT_TEMPLATE_RUN_COUNT,
  type TemplateStarterSelection,
} from '../../../features/plan-builder/template-starter';

function normalizeParams(params: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}

export default function StepBaseWeek() {
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const [selection, setSelection] = useState<TemplateStarterSelection>({
    mode: 'template',
    runCount: DEFAULT_TEMPLATE_RUN_COUNT,
  });

  const ctaTitle =
    selection.mode === 'template'
      ? `Build ${selection.runCount}-run week →`
      : 'Build clean week →';

  function handleNext() {
    router.push({
      pathname: '/onboarding/plan-builder/step-template',
      params: {
        ...normalizeParams(params),
        starterMode: selection.mode,
        templateRunCount: String(selection.runCount),
      },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.step}>STEP 4 OF 6</Text>
        <Text style={styles.title}>Build your{'\n'}base week</Text>
        <Text style={styles.subtitle}>
          Start from a pre-filled week, or begin with every day empty. You'll edit the days
          next.
        </Text>

        <StarterChoiceCards
          onSelect={setSelection}
          selectedMode={selection.mode}
          selectedRunCount={selection.runCount}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Btn title={ctaTitle} onPress={handleNext} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 124,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 29,
    color: C.ink,
    lineHeight: 33,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    marginBottom: 28,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: C.cream,
    borderTopWidth: 1,
    borderTopColor: `${C.border}AA`,
  },
});
