import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type {
  TemplateRunCount,
  TemplateStarterMode,
} from '../../features/plan-builder/template-starter';

interface StarterSummaryStripProps {
  mode: TemplateStarterMode;
  runCount: TemplateRunCount;
  volumeLabel: string;
  onChange: () => void;
}

export function StarterSummaryStrip({
  mode,
  runCount,
  volumeLabel,
  onChange,
}: StarterSummaryStripProps) {
  const title =
    mode === 'template' ? `${runCount}-run template` : 'Clean slate · empty week';
  const meta =
    mode === 'template'
      ? `Recommended base · ${volumeLabel}`
      : 'No assumptions · add your own structure';

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Starting point</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>

      <Pressable testID="starter-summary-change" onPress={onChange}>
        <Text style={styles.changeLink}>Change</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  meta: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  changeLink: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
});
