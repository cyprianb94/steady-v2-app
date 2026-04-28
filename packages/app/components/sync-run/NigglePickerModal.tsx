import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BODY_PART_LABELS,
  NIGGLE_OTHER_BODY_PART_MAX_LENGTH,
  NIGGLE_SEVERITIES,
  NIGGLE_WHEN_OPTIONS,
  type BodyPart,
  type NiggleSeverity,
  type NiggleSide,
  type NiggleWhen,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { EditableNiggle } from '../../features/sync/sync-run-detail';
import { SyncRunModalShell } from './SyncRunModalShell';

const SEVERITY_DESCRIPTIONS: Record<NiggleSeverity, string> = {
  niggle: 'noticed',
  mild: 'ran through',
  moderate: 'eased off',
  stop: 'had to stop',
};

const SEVERITY_LABELS: Record<NiggleSeverity, string> = {
  niggle: 'Niggle',
  mild: 'Mild',
  moderate: 'Moderate',
  stop: 'Stopped',
};

const BODY_PART_GROUPS: readonly {
  label: string;
  parts: readonly BodyPart[];
}[] = [
  { label: 'Back\n& hips', parts: ['back', 'hip', 'glute'] },
  { label: 'Thigh\n& knee', parts: ['hamstring', 'quad', 'knee'] },
  { label: 'Lower\nleg', parts: ['calf', 'shin', 'achilles'] },
  { label: 'Foot\n& ankle', parts: ['foot', 'ankle'] },
  { label: 'Other', parts: ['other'] },
];

const SIDE_OPTIONS: readonly NiggleSide[] = ['left', 'right', null];

interface NigglePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (niggle: EditableNiggle) => void;
}

function bodyPartDisplayLabel(part: BodyPart): string {
  return part === 'other' ? 'Something else' : BODY_PART_LABELS[part];
}

function sideDisplayLabel(option: NiggleSide): string {
  return option ? option[0].toUpperCase() + option.slice(1) : 'Both / N/A';
}

function bodyPartSummaryLabel(part: BodyPart, otherText: string): string {
  const label = part === 'other' ? otherText : BODY_PART_LABELS[part];
  return label.slice(0, 1).toLowerCase() + label.slice(1);
}

function buildDraftSummary({
  bodyPart,
  bodyPartOtherText,
  side,
  severity,
  when,
}: {
  bodyPart: BodyPart | null;
  bodyPartOtherText: string;
  side: NiggleSide;
  severity: NiggleSeverity | null;
  when: readonly NiggleWhen[];
}): string | null {
  if (!bodyPart || !severity || when.length === 0 || (bodyPart === 'other' && !bodyPartOtherText)) {
    return null;
  }

  const sidePrefix = side ? `${sideDisplayLabel(side)} ` : '';
  const severityLabel = severity === 'stop' ? 'stopped' : severity;
  return `${sidePrefix}${bodyPartSummaryLabel(bodyPart, bodyPartOtherText)} · ${severityLabel} · ${when.join(', ')}`;
}

export function NigglePickerModal({ visible, onClose, onAdd }: NigglePickerModalProps) {
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [bodyPartOtherText, setBodyPartOtherText] = useState('');
  const [side, setSide] = useState<NiggleSide>(null);
  const [severity, setSeverity] = useState<NiggleSeverity | null>(null);
  const [when, setWhen] = useState<NiggleWhen[]>([]);
  const trimmedOtherText = bodyPartOtherText.trim();

  useEffect(() => {
    if (!visible) {
      setBodyPart(null);
      setBodyPartOtherText('');
      setSide(null);
      setSeverity(null);
      setWhen([]);
    }
  }, [visible]);

  const canAdd = Boolean(bodyPart && severity && when.length > 0 && (bodyPart !== 'other' || trimmedOtherText));
  const draftSummary = buildDraftSummary({
    bodyPart,
    bodyPartOtherText: trimmedOtherText,
    side,
    severity,
    when,
  });

  function toggleWhen(option: NiggleWhen) {
    setWhen((current) => {
      const selected = new Set(current);
      if (selected.has(option)) {
        selected.delete(option);
      } else {
        selected.add(option);
      }
      return NIGGLE_WHEN_OPTIONS.filter((whenOption) => selected.has(whenOption));
    });
  }

  return (
    <SyncRunModalShell
      visible={visible}
      title="Flag a niggle"
      onClose={onClose}
      rightActionDisabled
      bottomBar={(
        <View style={styles.bottomBar}>
          <Text style={[styles.summaryLine, !draftSummary && styles.summaryLineEmpty]}>
            {draftSummary ?? 'Select where, how bad and when'}
          </Text>
          <Pressable
            onPress={() => {
              if (!bodyPart || !severity || when.length === 0 || (bodyPart === 'other' && !trimmedOtherText)) {
                return;
              }
              onAdd({
                bodyPart,
                bodyPartOtherText: bodyPart === 'other' ? trimmedOtherText : undefined,
                side,
                severity,
                when: [...when],
              });
            }}
            style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
            disabled={!canAdd}
          >
            <Text style={styles.addButtonText}>Add niggle</Text>
          </Pressable>
        </View>
      )}
    >
      <Text style={styles.screenTitle}>What showed up?</Text>
      <Text style={styles.screenSub}>
        Log enough detail to spot whether this settles or keeps coming back.
      </Text>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockLabel}>Where</Text>
          {bodyPart ? (
            <Text style={styles.inlineReadout}>{bodyPartDisplayLabel(bodyPart)}</Text>
          ) : null}
        </View>
        <View style={styles.bodyGroups}>
          {BODY_PART_GROUPS.map((group) => (
            <View key={group.label} style={styles.bodyGroup}>
              <Text style={styles.bodyGroupLabel}>{group.label}</Text>
              <View style={styles.bodyChipRow}>
                {group.parts.map((option) => {
                  const selected = bodyPart === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setBodyPart(option)}
                      accessibilityLabel={BODY_PART_LABELS[option]}
                      style={[
                        styles.bodyChip,
                        option === 'other' && styles.bodyChipOther,
                        selected && styles.bodyChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bodyChipText,
                          option === 'other' && styles.bodyChipOtherText,
                          selected && styles.bodyChipTextSelected,
                        ]}
                      >
                        {bodyPartDisplayLabel(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
        {bodyPart === 'other' ? (
          <View style={styles.otherInputWrap}>
            <Text style={styles.otherInputLabel}>Where exactly?</Text>
            <TextInput
              value={bodyPartOtherText}
              onChangeText={setBodyPartOtherText}
              placeholder="e.g. Groin or upper calf"
              placeholderTextColor={C.muted}
              style={styles.otherInput}
              maxLength={NIGGLE_OTHER_BODY_PART_MAX_LENGTH}
              returnKeyType="done"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockLabel}>Which side</Text>
        </View>
        <View style={styles.sideRow}>
          {SIDE_OPTIONS.map((option) => {
            const selected = side === option;
            return (
              <Pressable
                key={String(option)}
                onPress={() => setSide(option)}
                style={[styles.sidePill, selected && styles.sidePillSelected]}
              >
                <Text style={[styles.sidePillText, selected && styles.sidePillTextSelected]}>
                  {sideDisplayLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockLabel}>How bad</Text>
        </View>
        <View style={styles.severityGrid}>
          {NIGGLE_SEVERITIES.map((option) => {
            const selected = severity === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSeverity(option)}
                style={[
                  styles.severityPill,
                  selected && option === 'niggle' && styles.severityPillSelected,
                  selected && option === 'mild' && styles.severityPillWarn,
                  selected && option === 'moderate' && styles.severityPillWarn,
                  selected && option === 'stop' && styles.severityPillStop,
                ]}
              >
                <Text
                  style={[
                    styles.severityLevel,
                    selected && option === 'mild' && styles.severityWarnText,
                    selected && option === 'moderate' && styles.severityWarnText,
                    selected && option === 'stop' && styles.severityStopText,
                  ]}
                >
                  {SEVERITY_LABELS[option]}
                </Text>
                <Text
                  style={[
                    styles.severitySub,
                    selected && option === 'mild' && styles.severityWarnSub,
                    selected && option === 'moderate' && styles.severityWarnSub,
                    selected && option === 'stop' && styles.severityStopSub,
                  ]}
                >
                  {SEVERITY_DESCRIPTIONS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockLabel}>When</Text>
          <Text style={styles.inlineReadout}>Choose all that apply</Text>
        </View>
        <View style={styles.whenRow}>
          {NIGGLE_WHEN_OPTIONS.map((option) => {
            const selected = when.includes(option);
            return (
              <Pressable
                key={option}
                onPress={() => toggleWhen(option)}
                style={[styles.whenPill, selected && styles.whenPillSelected]}
            >
              <Text style={[styles.whenPillText, selected && styles.whenPillTextSelected]}>
                {option[0].toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          );
          })}
        </View>
      </View>
    </SyncRunModalShell>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 32,
    lineHeight: 36,
    color: C.ink,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  block: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 13,
  },
  blockLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  inlineReadout: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.clay,
    textAlign: 'right',
  },
  bodyGroups: {
    gap: 9,
  },
  bodyGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bodyGroupLabel: {
    width: 78,
    paddingTop: 10,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
  },
  bodyChipRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyChip: {
    minWidth: 78,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyChipOther: {
    minWidth: 118,
    backgroundColor: C.surface,
  },
  bodyChipSelected: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
    borderLeftWidth: 3,
  },
  bodyChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink2,
  },
  bodyChipOtherText: {
    color: C.muted,
  },
  bodyChipTextSelected: {
    color: C.clay,
  },
  otherInputWrap: {
    marginTop: 12,
    gap: 8,
  },
  otherInputLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  otherInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink,
  },
  sideRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sidePill: {
    flex: 1,
    minHeight: 48,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
  },
  sidePillSelected: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  sidePillText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink2,
  },
  sidePillTextSelected: {
    color: C.surface,
  },
  severityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  severityPill: {
    width: '48.5%',
    minHeight: 64,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    justifyContent: 'center',
    gap: 3,
  },
  severityPillSelected: {
    borderColor: C.ink2,
    backgroundColor: C.surface,
  },
  severityPillWarn: {
    borderColor: C.amber,
    backgroundColor: C.amberBg,
  },
  severityPillStop: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  severityLevel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  severitySub: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.muted,
  },
  severityWarnText: {
    color: C.amber,
  },
  severityWarnSub: {
    color: C.muted,
  },
  severityStopText: {
    color: C.clay,
  },
  severityStopSub: {
    color: C.muted,
  },
  whenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whenPill: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
  },
  whenPillSelected: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  whenPillText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink2,
  },
  whenPillTextSelected: {
    color: C.surface,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: C.surface,
  },
  summaryLine: {
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.ink,
  },
  summaryLineEmpty: {
    fontFamily: FONTS.mono,
    color: C.muted,
  },
  addButton: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: 'center',
    paddingVertical: 16,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.surface,
  },
});
