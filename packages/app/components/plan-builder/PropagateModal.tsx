import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PhaseName } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';
import { GorhomSheet } from '../ui/GorhomSheet';

interface PropagateModalProps {
  changeDesc?: string | null;
  weekIndex: number;
  totalWeeks: number;
  dayIndex?: number;
  sessionDate?: string | null;
  phaseName: PhaseName;
  phaseWeekCount?: number;
  title?: string;
  body?: string | null;
  applyLabel?: string;
  scopeLabels?: Partial<Record<'this' | 'remaining' | 'build', string>>;
  initialScope?: 'this' | 'remaining' | 'build';
  onApply: (scope: 'this' | 'remaining' | 'build') => void;
  onClose: () => void;
}

const OPTIONS = [
  { key: 'this' as const, label: 'This session only' },
  { key: 'remaining' as const, label: 'This session in remaining weeks' },
  { key: 'build' as const, label: '' },
];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LONG_DAYS_BY_WEEK_INDEX = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function phaseLabel(phaseName: PhaseName): string {
  return `${phaseName.slice(0, 1)}${phaseName.slice(1).toLowerCase()}`;
}

function parseIsoDateParts(date: string | null | undefined): { shortLabel: string; longDay: string } | null {
  if (!date) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = date.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(value.getTime()) ||
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  const shortDay = SHORT_DAYS[value.getUTCDay()];
  const longDay = LONG_DAYS_BY_WEEK_INDEX[value.getUTCDay() === 0 ? 6 : value.getUTCDay() - 1];
  return {
    shortLabel: `${shortDay} ${day} ${MONTHS[month - 1]}`,
    longDay,
  };
}

function dayContext(dayIndex: number | undefined, sessionDate: string | null | undefined) {
  const fromDate = parseIsoDateParts(sessionDate);
  if (fromDate) {
    return fromDate;
  }

  if (dayIndex == null) {
    return null;
  }

  const longDay = LONG_DAYS_BY_WEEK_INDEX[dayIndex];
  if (!longDay) {
    return null;
  }

  return {
    shortLabel: longDay.slice(0, 3),
    longDay,
  };
}

export function PropagateModal({
  changeDesc = null,
  weekIndex,
  totalWeeks,
  dayIndex,
  sessionDate,
  phaseName,
  phaseWeekCount,
  title = 'Where do you want this change applied?',
  body = null,
  applyLabel = 'Apply change',
  scopeLabels,
  initialScope = 'remaining',
  onApply,
  onClose,
}: PropagateModalProps) {
  const [scope, setScope] = useState<'this' | 'remaining' | 'build'>(initialScope);
  const phaseDisplay = phaseLabel(phaseName);
  const phaseWeeks = phaseWeekCount ?? 1;
  const sessionDay = dayContext(dayIndex, sessionDate);

  const subs: Record<string, string> = {
    this: sessionDay
      ? `${sessionDay.shortLabel} · Week ${weekIndex + 1}`
      : `Week ${weekIndex + 1} only`,
    remaining: sessionDay
      ? `${sessionDay.longDay} sessions from week ${weekIndex + 1} onwards`
      : `Weeks ${weekIndex + 1}–${totalWeeks}`,
    build: sessionDay
      ? `${sessionDay.longDay} sessions in ${phaseDisplay}`
      : phaseWeeks === 1
        ? `Only 1 ${phaseDisplay.toLowerCase()} week in this plan`
        : `${phaseWeeks} ${phaseDisplay.toLowerCase()} weeks in this plan`,
  };

  return (
    <GorhomSheet open onDismiss={onClose} backgroundColor={C.surface} backdropOpacity={0.65}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {changeDesc ? <Text style={styles.changeDesc}>{changeDesc}</Text> : null}
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>

        <View style={styles.options}>
          {OPTIONS.map((o) => {
            const active = scope === o.key;
            const optionLabel =
              scopeLabels?.[o.key] ??
              (o.key === 'build' ? 'This session in this phase' : o.label);
            return (
              <Pressable
                key={o.key}
                onPress={() => setScope(o.key)}
                style={[
                  styles.option,
                  {
                    borderColor: active ? C.clay : C.border,
                    backgroundColor: active ? C.clayBg : C.cream,
                  },
                ]}
              >
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { fontWeight: active ? '600' : '400' },
                    ]}
                  >
                    {optionLabel}
                  </Text>
                  <Text style={styles.optionSub}>{subs[o.key]}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: active ? C.clay : C.border,
                      backgroundColor: active ? C.clay : 'transparent',
                    },
                  ]}
                >
                  {active && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Btn title={applyLabel} onPress={() => onApply(scope)} fullWidth />
        </View>
      </View>
    </GorhomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 19,
    color: C.ink,
    marginBottom: 5,
  },
  changeDesc: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.clay,
  },
  body: {
    marginTop: 8,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.ink2,
  },
  options: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink,
  },
  optionSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
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
    backgroundColor: 'white',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
});
