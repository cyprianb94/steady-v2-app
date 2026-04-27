import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import {
  TEMPLATE_RUN_COUNTS,
  type TemplateRunCount,
  type TemplateStarterMode,
  type TemplateStarterSelection,
} from '../../features/plan-builder/template-starter';

interface StarterChoiceCardsProps {
  onSelect: (selection: TemplateStarterSelection) => void;
  selectedMode: TemplateStarterMode;
  selectedRunCount: TemplateRunCount;
}

const RUN_COUNT_SUMMARY: Record<TemplateRunCount, string> = {
  1: 'One key run. Useful for returning gently or building around another sport.',
  2: 'Easy run plus long run. A minimal rhythm with space to recover.',
  3: 'Easy, quality, and long run. A simple balanced base.',
  4: 'Adds one more easy day around a quality session and long run.',
  5: 'Two quality sessions, two easy runs, and a long run.',
  6: 'Easy runs, quality sessions, rest, and a long run are placed for you.',
  7: 'Every day has a run. Keep the easy days genuinely easy.',
};

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

export function StarterChoiceCards({
  onSelect,
  selectedMode,
  selectedRunCount,
}: StarterChoiceCardsProps) {
  const templateSelected = selectedMode === 'template';
  const cleanSelected = selectedMode === 'clean';

  return (
    <View>
      <Pressable
        testID="starter-choice-template"
        onPress={() => onSelect({ mode: 'template', runCount: selectedRunCount })}
        style={[styles.card, templateSelected && styles.cardSelected]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Build from template</Text>
            <Text style={styles.cardCopy}>
              Pre-fill your base week from a run count. Move, edit, or delete every session next.
            </Text>
          </View>
          <Radio selected={templateSelected} />
        </View>

        <View style={styles.selectorPanel}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorLabel}>Runs per week</Text>
            <Text style={styles.selectorHint}>Tap a number</Text>
          </View>
          <View style={styles.runCountRow}>
            {TEMPLATE_RUN_COUNTS.map((runCount) => {
              const selected = templateSelected && selectedRunCount === runCount;
              return (
                <Pressable
                  key={runCount}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onSelect({ mode: 'template', runCount });
                  }}
                  style={[styles.runCountButton, selected && styles.runCountButtonSelected]}
                  testID={`starter-run-count-${runCount}`}
                >
                  <Text style={[styles.runCountText, selected && styles.runCountTextSelected]}>
                    {runCount}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.templateSummary}>
            <Text style={styles.templateSummaryTitle}>{selectedRunCount}-run week</Text>
            <Text style={styles.templateSummaryCopy}>{RUN_COUNT_SUMMARY[selectedRunCount]}</Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        testID="starter-choice-clean"
        onPress={() => onSelect({ mode: 'clean', runCount: selectedRunCount })}
        style={[styles.card, cleanSelected && styles.cardCleanSelected]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Clean slate</Text>
            <Text style={styles.cardCopy}>
              All seven days start empty. Use this if you want to place every session yourself.
            </Text>
          </View>
          <Radio selected={cleanSelected} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  cardCleanSelected: {
    borderColor: C.muted,
    backgroundColor: 'rgba(154, 142, 126, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
    marginBottom: 6,
  },
  cardCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: C.clay,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.clay,
  },
  selectorPanel: {
    marginTop: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.20)',
    borderRadius: 14,
    padding: 12,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectorLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
  },
  selectorHint: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  runCountRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: C.cream,
    borderRadius: 18,
    padding: 4,
    marginBottom: 12,
  },
  runCountButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runCountButtonSelected: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.clay,
  },
  runCountText: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.muted,
  },
  runCountTextSelected: {
    color: C.clay,
  },
  templateSummary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    padding: 12,
  },
  templateSummaryTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    marginBottom: 4,
  },
  templateSummaryCopy: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.muted,
  },
});
