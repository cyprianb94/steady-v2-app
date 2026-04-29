import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, {
  type DatePickerBaseProps,
  type DateType,
  useDefaultStyles,
} from 'react-native-ui-datepicker';
import { Btn } from '../ui/Btn';
import { GorhomSheet } from '../ui/GorhomSheet';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import {
  dateTypeToIsoDate,
  formatShortDate,
  isoDateToLocalDate,
  parseIsoDate,
  weeksToRace,
} from '../../features/plan-builder/race-date';

interface RaceDateBottomSheetProps {
  open: boolean;
  value: string;
  minDate: string;
  todayIso: string;
  onClose: () => void;
  onConfirm: (nextDate: string) => void;
}

const FIRST_DAY_OF_WEEK = 1;

export function RaceDateBottomSheet({
  open,
  value,
  minDate,
  todayIso,
  onClose,
  onConfirm,
}: RaceDateBottomSheetProps) {
  const [draftDate, setDraftDate] = useState(value);
  const defaultCalendarStyles = useDefaultStyles('light');
  const startYear = parseIsoDate(minDate).year;
  const endYear = startYear + 5;
  const previewWeeks = weeksToRace(todayIso, draftDate);
  const datePickerTestProps = { testID: 'race-date-calendar' } as const;

  const calendarStyles = useMemo<NonNullable<DatePickerBaseProps['styles']>>(() => ({
    ...defaultCalendarStyles,
    day: {
      ...(defaultCalendarStyles.day ?? {}),
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 38,
      borderRadius: 999,
    },
    day_label: {
      ...(defaultCalendarStyles.day_label ?? {}),
      color: C.ink,
      fontFamily: FONTS.mono,
      fontSize: 12,
    },
    weekday_label: {
      ...(defaultCalendarStyles.weekday_label ?? {}),
      color: C.muted,
      fontFamily: FONTS.sansSemiBold,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    month_selector_label: {
      ...(defaultCalendarStyles.month_selector_label ?? {}),
      color: C.ink,
      fontFamily: FONTS.serifBold,
      fontSize: 19,
    },
    year_selector_label: {
      ...(defaultCalendarStyles.year_selector_label ?? {}),
      color: C.clay,
      fontFamily: FONTS.monoBold,
      fontSize: 14,
    },
    button_prev: {
      ...(defaultCalendarStyles.button_prev ?? {}),
      backgroundColor: C.surface,
      borderColor: C.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: 4,
    },
    button_next: {
      ...(defaultCalendarStyles.button_next ?? {}),
      backgroundColor: C.surface,
      borderColor: C.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: 4,
    },
    selected: {
      ...(defaultCalendarStyles.selected ?? {}),
      backgroundColor: C.clay,
      borderColor: C.clay,
      borderRadius: 999,
      borderWidth: 1,
    },
    selected_label: {
      ...(defaultCalendarStyles.selected_label ?? {}),
      color: '#FFFFFF',
      fontFamily: FONTS.monoBold,
    },
    today: {
      ...(defaultCalendarStyles.today ?? {}),
      backgroundColor: C.clayBg,
      borderColor: 'rgba(196,82,42,0.24)',
      borderRadius: 999,
      borderWidth: 1,
    },
    today_label: {
      ...(defaultCalendarStyles.today_label ?? {}),
      color: C.clay,
      fontFamily: FONTS.sansSemiBold,
    },
    outside_label: {
      ...(defaultCalendarStyles.outside_label ?? {}),
      color: C.muted,
    },
    disabled_label: {
      ...(defaultCalendarStyles.disabled_label ?? {}),
      color: C.muted,
      opacity: 0.38,
    },
  }), [defaultCalendarStyles]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDateChange = useCallback(({ date }: { date: DateType }) => {
    const nextDate = dateTypeToIsoDate(date);
    if (nextDate) {
      setDraftDate(nextDate);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(draftDate);
    onClose();
  }, [draftDate, onClose, onConfirm]);

  if (!open) {
    return null;
  }

  return (
    <GorhomSheet
      open={open}
      onDismiss={handleDismiss}
      backgroundColor={C.cream}
      maxHeightRatio={0.88}
      wrapContent={false}
    >
      <View style={styles.sheet}>
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Pick race date</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaCopy}>
              <Text style={styles.subtitle}>{formatShortDate(draftDate)}</Text>
              <Text style={styles.hint}>Tap any date and the plan length updates automatically.</Text>
            </View>
            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>{previewWeeks} wks</Text>
            </View>
          </View>

          <View style={styles.calendarCard}>
            <DateTimePicker
              date={isoDateToLocalDate(draftDate)}
              endYear={endYear}
              firstDayOfWeek={FIRST_DAY_OF_WEEK}
              minDate={isoDateToLocalDate(minDate)}
              mode="single"
              monthCaptionFormat="full"
              onChange={handleDateChange}
              startYear={startYear}
              styles={calendarStyles}
              weekdaysFormat="short"
              {...(datePickerTestProps as any)}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleDismiss}
              style={styles.secondaryAction}
              testID="race-date-cancel"
            >
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
            <View style={styles.primaryAction}>
              <Btn title="Done" onPress={handleConfirm} fullWidth />
            </View>
          </View>
        </BottomSheetScrollView>
      </View>
    </GorhomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 24,
  },
  title: {
    color: C.ink,
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    marginBottom: 10,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaCopy: {
    flex: 1,
  },
  subtitle: {
    color: C.clay,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    marginBottom: 4,
  },
  hint: {
    color: C.muted,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  previewPill: {
    alignItems: 'center',
    backgroundColor: `${C.metricTime}14`,
    borderColor: `${C.metricTime}26`,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewPillText: {
    color: C.metricTime,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
  },
  calendarCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 12,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 22,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: C.ink,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  primaryAction: {
    flex: 1.2,
  },
});
