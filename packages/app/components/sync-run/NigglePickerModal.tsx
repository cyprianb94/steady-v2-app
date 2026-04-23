import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BODY_PART_LABELS,
  BODY_PARTS,
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

interface NigglePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (niggle: EditableNiggle) => void;
}

export function NigglePickerModal({ visible, onClose, onAdd }: NigglePickerModalProps) {
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [bodyPartOtherText, setBodyPartOtherText] = useState('');
  const [side, setSide] = useState<NiggleSide>(null);
  const [severity, setSeverity] = useState<NiggleSeverity | null>(null);
  const [when, setWhen] = useState<NiggleWhen | null>(null);
  const trimmedOtherText = bodyPartOtherText.trim();

  useEffect(() => {
    if (!visible) {
      setBodyPart(null);
      setBodyPartOtherText('');
      setSide(null);
      setSeverity(null);
      setWhen(null);
    }
  }, [visible]);

  const canAdd = Boolean(bodyPart && severity && when && (bodyPart !== 'other' || trimmedOtherText));

  return (
    <SyncRunModalShell
      visible={visible}
      title="Flag a niggle"
      onClose={onClose}
      rightActionDisabled
      bottomBar={(
        <View style={styles.bottomBar}>
          <Pressable
            onPress={() => {
              if (!bodyPart || !severity || !when || (bodyPart === 'other' && !trimmedOtherText)) {
                return;
              }
              onAdd({
                bodyPart,
                bodyPartOtherText: bodyPart === 'other' ? trimmedOtherText : undefined,
                side,
                severity,
                when,
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
      <Text style={styles.screenTitle}>Flag a niggle</Text>
      <Text style={styles.screenSub}>
        Small catches early. We&apos;ll use this to watch for patterns and protect your recovery.
      </Text>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Where</Text>
        <View style={styles.bodyGrid}>
          {BODY_PARTS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setBodyPart(option)}
              style={[styles.bodyPill, bodyPart === option && styles.bodyPillSelected]}
            >
              <Text style={[styles.bodyPillText, bodyPart === option && styles.bodyPillTextSelected]}>
                {BODY_PART_LABELS[option]}
              </Text>
            </Pressable>
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
        <Text style={styles.blockLabel}>Which side</Text>
        <View style={styles.sideRow}>
          {(['left', 'right', null] as NiggleSide[]).map((option) => {
            const selected = side === option;
            return (
              <Pressable
                key={String(option)}
                onPress={() => setSide(option)}
                style={[styles.sidePill, selected && styles.sidePillSelected]}
              >
                <Text style={[styles.sidePillText, selected && styles.sidePillTextSelected]}>
                  {option ? option[0].toUpperCase() + option.slice(1) : 'Both / N/A'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>How bad</Text>
        <View style={styles.severityRow}>
          {NIGGLE_SEVERITIES.map((option) => {
            const selected = severity === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSeverity(option)}
                style={[
                  styles.severityPill,
                  selected && option === 'niggle' && styles.severityPillWarn,
                  selected && option === 'mild' && styles.severityPillWarn,
                  selected && option === 'moderate' && styles.severityPillModerate,
                  selected && option === 'stop' && styles.severityPillStop,
                ]}
              >
                <Text style={[styles.severityLevel, selected && option === 'stop' && styles.severityStopText]}>
                  {option[0].toUpperCase() + option.slice(1)}
                </Text>
                <Text style={[styles.severitySub, selected && option === 'stop' && styles.severityStopSub]}>
                  {SEVERITY_DESCRIPTIONS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>When</Text>
        <View style={styles.whenRow}>
          {NIGGLE_WHEN_OPTIONS.map((option) => {
            const selected = when === option;
            return (
              <Pressable
                key={option}
                onPress={() => setWhen(option)}
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
    fontSize: 26,
    color: C.ink,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    paddingHorizontal: 4,
    marginBottom: 22,
  },
  block: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  blockLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bodyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyPill: {
    minWidth: '30%',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
  },
  bodyPillSelected: {
    borderColor: C.clay,
    backgroundColor: C.clay,
  },
  bodyPillText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  bodyPillTextSelected: {
    color: C.surface,
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
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
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
    padding: 14,
    borderRadius: 12,
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
  severityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  severityPill: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    gap: 4,
  },
  severityPillWarn: {
    borderColor: C.amber,
    backgroundColor: C.amberBg,
  },
  severityPillModerate: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  severityPillStop: {
    borderColor: C.clay,
    backgroundColor: C.clay,
  },
  severityLevel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
  severitySub: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.muted,
    textAlign: 'center',
  },
  severityStopText: {
    color: C.surface,
  },
  severityStopSub: {
    color: 'rgba(253,240,235,0.75)',
  },
  whenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whenPill: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
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
    fontSize: 13,
    color: C.ink2,
  },
  whenPillTextSelected: {
    color: C.surface,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: C.surface,
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
