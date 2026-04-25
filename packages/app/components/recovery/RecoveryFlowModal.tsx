import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { Injury, TrainingPlan } from '@steady/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';
import { GorhomSheet } from '../ui/GorhomSheet';

type RecoveryModalMode = 'mark' | 'resume';

interface RecoveryFlowModalProps {
  visible: boolean;
  mode: RecoveryModalMode;
  plan: TrainingPlan;
  currentWeekNumber: number;
  injury?: Injury | null;
  busy?: boolean;
  onClose: () => void;
  onMarkInjury: (name: string) => Promise<void> | void;
  onEndRecovery: (option: { type: 'current' } | { type: 'choose'; weekNumber: number }) => Promise<void> | void;
}

export function RecoveryFlowModal({
  visible,
  mode,
  plan,
  currentWeekNumber,
  injury = null,
  busy = false,
  onClose,
  onMarkInjury,
  onEndRecovery,
}: RecoveryFlowModalProps) {
  const insets = useSafeAreaInsets();
  const [injuryName, setInjuryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState<'current' | 'choose'>('current');
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(currentWeekNumber);

  useEffect(() => {
    if (!visible) return;
    setInjuryName(injury?.name ?? '');
    setError(null);
    setResumeMode('current');
    setSelectedWeekNumber(currentWeekNumber);
  }, [visible, injury?.name, currentWeekNumber]);

  const weekOptions = useMemo(
    () =>
      plan.weeks.map((week) => ({
        weekNumber: week.weekNumber,
        label: `Week ${week.weekNumber}`,
        sublabel: week.phase,
      })),
    [plan.weeks],
  );

  async function handleConfirm() {
    if (mode === 'mark') {
      const trimmed = injuryName.trim();
      if (!trimmed) {
        setError('Add an injury name to continue.');
        return;
      }
      await onMarkInjury(trimmed);
      return;
    }

    if (resumeMode === 'current') {
      await onEndRecovery({ type: 'current' });
      return;
    }

    await onEndRecovery({ type: 'choose', weekNumber: selectedWeekNumber });
  }

  return (
    <GorhomSheet open={visible} onDismiss={onClose} backgroundColor={C.surface} backdropOpacity={0.65} maxHeightRatio={0.82}>
      <KeyboardAvoidingView
        testID="recovery-keyboard-frame"
        style={styles.keyboardFrame}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'mark' ? 'Mark Injury' : 'End Recovery'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'mark'
                ? 'Give the injury a name so the recovery state is clear across the app.'
                : 'Choose how the plan should pick back up once recovery ends.'}
            </Text>
          </View>

          {mode === 'mark' ? (
            <View style={styles.body}>
              <Text style={styles.label}>Injury name</Text>
              <BottomSheetTextInput
                value={injuryName}
                onChangeText={(value) => {
                  setInjuryName(value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Calf strain"
                placeholderTextColor={C.muted}
                style={styles.input}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleConfirm();
                }}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          ) : (
            <View style={styles.body}>
              <Pressable
                onPress={() => setResumeMode('current')}
                style={[styles.option, resumeMode === 'current' && styles.optionActive]}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Resume from current week</Text>
                  <Text style={styles.optionSub}>Use the week that matches today's dates.</Text>
                </View>
                <Radio active={resumeMode === 'current'} />
              </Pressable>

              <Pressable
                onPress={() => setResumeMode('choose')}
                style={[styles.option, resumeMode === 'choose' && styles.optionActive]}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Choose a week</Text>
                  <Text style={styles.optionSub}>Pick a specific block week to resume from.</Text>
                </View>
                <Radio active={resumeMode === 'choose'} />
              </Pressable>

              {resumeMode === 'choose' ? (
                <ScrollView
                  style={styles.weekList}
                  contentContainerStyle={styles.weekListContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {weekOptions.map((option) => {
                    const active = selectedWeekNumber === option.weekNumber;
                    return (
                      <Pressable
                        key={option.weekNumber}
                        onPress={() => setSelectedWeekNumber(option.weekNumber)}
                        style={[styles.weekOption, active && styles.weekOptionActive]}
                      >
                        <View>
                          <Text style={styles.weekOptionTitle}>{option.label}</Text>
                          <Text style={styles.weekOptionSub}>{option.sublabel}</Text>
                        </View>
                        <Radio active={active} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          )}

          <View style={[styles.footer, { paddingBottom: 18 + Math.max(insets.bottom, 10) }]}>
            <Btn title="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
            <Btn
              title={busy ? 'Working...' : mode === 'mark' ? 'Start recovery' : 'Resume plan'}
              onPress={handleConfirm}
              disabled={busy}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </GorhomSheet>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <View
      style={[
        styles.radio,
        {
          borderColor: active ? C.clay : C.border,
          backgroundColor: active ? C.clay : 'transparent',
        },
      ]}
    >
      {active ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardFrame: {
    width: '100%',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    flexShrink: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  input: {
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
  error: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.clay,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.cream,
  },
  optionActive: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  optionText: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  optionSub: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  weekList: {
    maxHeight: 220,
  },
  weekListContent: {
    gap: 8,
    paddingTop: 2,
  },
  weekOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },
  weekOptionActive: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  weekOptionTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  weekOptionSub: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
});
