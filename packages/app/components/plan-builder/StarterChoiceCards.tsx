import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { sessionKm } from '@steady/types';
import type { PlannedSession } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';
import { formatDistance, type DistanceUnits } from '../../lib/units';
import {
  STEADY_TEMPLATE,
  type TemplateStarterMode,
} from '../../features/plan-builder/template-starter';

interface StarterChoiceCardsProps {
  onSelect: (mode: TemplateStarterMode) => void;
  units: DistanceUnits;
}

const PREVIEW_DAY_INDICES = [0, 1, 3, 6] as const;

export function StarterChoiceCards({ onSelect, units }: StarterChoiceCardsProps) {
  const templateVolume = STEADY_TEMPLATE.reduce(
    (sum, session) => sum + sessionKm((session as PlannedSession | null) ?? null),
    0,
  );

  return (
    <View>
      <View style={[styles.card, styles.templateCard]}>
        <View style={styles.cardRailClay} />
        <View style={styles.cardHeader}>
          <View style={styles.chipTemplate}>
            <Text style={styles.chipTextTemplate}>Recommended</Text>
          </View>
          <Text style={styles.volumeValue}>~{formatDistance(templateVolume, units, { spaced: true })} / week</Text>
        </View>

        <Text style={styles.cardTitle}>Steady template</Text>
        <Text style={styles.cardCopy}>
          Start from a balanced week with easy runs, a workout, a rest day, and a long run already in place.
        </Text>

        <View style={styles.previewGrid}>
          {PREVIEW_DAY_INDICES.map((dayIndex) => {
            const session = STEADY_TEMPLATE[dayIndex];

            return (
              <View
                key={DAYS[dayIndex]}
                style={[
                  styles.previewCell,
                  session?.type === 'EASY' && styles.previewEasy,
                  session?.type === 'INTERVAL' && styles.previewInterval,
                  session?.type === 'TEMPO' && styles.previewTempo,
                  session?.type === 'LONG' && styles.previewLong,
                ]}
              >
                <Text style={styles.previewDay}>{DAYS[dayIndex]}</Text>
                <Text style={styles.previewMain} numberOfLines={1}>
                  {session ? sessionLabel(session, units) : 'Rest day'}
                </Text>
                <Text style={styles.previewSub}>
                  {session?.type === 'INTERVAL'
                    ? 'Intervals'
                    : session?.type === 'TEMPO'
                      ? 'Tempo'
                      : session?.type === 'LONG'
                        ? 'Long Run'
                        : session?.type === 'EASY'
                          ? 'Easy Run'
                          : 'Rest day'}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardNote}>
            Includes a steady default structure you can edit and rearrange before generating.
          </Text>
          <Pressable
            testID="starter-choice-template"
            onPress={() => onSelect('template')}
            style={[styles.inlineButton, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>Use Steady template</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardRailMuted} />
        <View style={styles.cardHeader}>
          <View style={styles.chipClean}>
            <Text style={styles.chipTextClean}>Clean slate</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>Start clean</Text>
        <Text style={styles.cardCopy}>
          Build your own week from scratch and add only the sessions you know you can support right now.
        </Text>

        <View style={styles.blankPreview}>
          <View style={styles.blankBadge}>
            <Text style={styles.blankBadgeText}>+</Text>
          </View>
          <Text style={styles.blankTitle}>Empty week</Text>
          <Text style={styles.blankCopy}>
            Every day starts open so you can shape the week deliberately instead of editing around assumptions.
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardNote}>
            Useful if you already know your own rhythm or want to build conservatively from zero.
          </Text>
          <Pressable
            testID="starter-choice-clean"
            onPress={() => onSelect('clean')}
            style={[styles.inlineButton, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Start clean</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  templateCard: {
    borderColor: `${C.clay}38`,
  },
  cardRailClay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.clay,
  },
  cardRailMuted: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: `${C.muted}45`,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  chipTemplate: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: C.clayBg,
  },
  chipClean: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(154, 142, 126, 0.1)',
  },
  chipTextTemplate: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.clay,
  },
  chipTextClean: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
  },
  volumeValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.ink,
  },
  cardTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    lineHeight: 24,
    color: C.ink,
    marginBottom: 6,
  },
  cardCopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.ink2,
    marginBottom: 14,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  previewCell: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(244, 239, 230, 0.75)',
    paddingVertical: 10,
    paddingHorizontal: 11,
    minHeight: 58,
  },
  previewEasy: {
    backgroundColor: C.forestBg,
    borderColor: 'rgba(42, 92, 69, 0.16)',
  },
  previewInterval: {
    backgroundColor: C.clayBg,
    borderColor: 'rgba(196, 82, 42, 0.16)',
  },
  previewTempo: {
    backgroundColor: C.amberBg,
    borderColor: 'rgba(212, 136, 42, 0.18)',
  },
  previewLong: {
    backgroundColor: 'rgba(237, 241, 248, 0.95)',
    borderColor: 'rgba(27, 58, 107, 0.18)',
  },
  previewDay: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 7,
  },
  previewMain: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 14,
    color: C.ink,
  },
  previewSub: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  blankPreview: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(229, 221, 208, 0.95)',
    backgroundColor: 'rgba(253, 250, 245, 0.92)',
    minHeight: 132,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  blankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(154, 142, 126, 0.22)',
    backgroundColor: 'rgba(253, 250, 245, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  blankBadgeText: {
    fontFamily: FONTS.sans,
    fontSize: 18,
    color: C.muted,
  },
  blankTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 18,
    lineHeight: 20,
    color: C.ink2,
    marginBottom: 6,
  },
  blankCopy: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardNote: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  inlineButton: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  primaryButton: {
    backgroundColor: C.clay,
    borderColor: C.clay,
  },
  secondaryButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
});
