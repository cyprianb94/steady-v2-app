import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CROSS_TRAINING_TYPES, type CrossTrainingEntry, type CrossTrainingType } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { SectionLabel } from '../ui/SectionLabel';
import { Btn } from '../ui/Btn';
import { DAYS, addDaysIso } from '../../lib/plan-helpers';

interface CrossTrainingLogProps {
  entries: CrossTrainingEntry[];
  weekStartDate: string;
  isSaving?: boolean;
  deletingId?: string | null;
  onAdd: (input: {
    date: string;
    type: CrossTrainingType;
    durationMinutes: number;
  }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function CrossTrainingLog({
  entries,
  weekStartDate,
  isSaving = false,
  deletingId = null,
  onAdd,
  onDelete,
}: CrossTrainingLogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState(weekStartDate);
  const [selectedType, setSelectedType] = useState<CrossTrainingType>(CROSS_TRAINING_TYPES[0]);
  const [durationMinutes, setDurationMinutes] = useState('45');

  useEffect(() => {
    setSelectedDate(weekStartDate);
  }, [weekStartDate]);

  const weekDates = useMemo(
    () => DAYS.map((day, index) => ({
      day,
      date: addDaysIso(weekStartDate, index),
    })),
    [weekStartDate],
  );

  const orderedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.date === b.date) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.date < b.date ? 1 : -1;
      }),
    [entries],
  );

  async function handleAdd() {
    const duration = Number(durationMinutes);
    if (!duration || duration < 1) {
      return;
    }

    await onAdd({
      date: selectedDate,
      type: selectedType,
      durationMinutes: duration,
    });

    setIsAdding(false);
    setDurationMinutes('45');
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <SectionLabel>Cross-Training This Week</SectionLabel>
        <Pressable onPress={() => setIsAdding((value) => !value)}>
          <Text style={styles.addLink}>{isAdding ? 'Close' : 'Add'}</Text>
        </Pressable>
      </View>

      {isAdding ? (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Day</Text>
          <View style={styles.chipWrap}>
            {weekDates.map((item) => (
              <Pressable
                key={item.date}
                onPress={() => setSelectedDate(item.date)}
                style={[styles.chip, selectedDate === item.date && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedDate === item.date && styles.chipTextActive]}>
                  {item.day}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Type</Text>
          <View style={styles.chipWrap}>
            {CROSS_TRAINING_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setSelectedType(type)}
                style={[styles.chip, selectedType === type && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Duration (minutes)</Text>
          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
            style={styles.input}
            editable={!isSaving}
          />

          <View style={styles.buttonRow}>
            <Btn title="Cancel" variant="secondary" onPress={() => setIsAdding(false)} disabled={isSaving} />
            <Btn title="Save" onPress={handleAdd} disabled={isSaving || !durationMinutes} />
          </View>
        </View>
      ) : null}

      {orderedEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No cross-training logged yet this week.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {orderedEntries.map((entry) => {
            const weekDay = weekDates.find((item) => item.date === entry.date);
            return (
              <View key={entry.id} style={styles.row}>
                <View style={styles.dayCol}>
                  <Text style={styles.dayName}>{weekDay?.day ?? 'Day'}</Text>
                  <Text style={styles.dayDate}>{formatShortDate(entry.date)}</Text>
                </View>
                <View style={styles.centerCol}>
                  <View style={styles.dot} />
                  <Text style={styles.entryText}>
                    {entry.type} - {entry.durationMinutes}min
                  </Text>
                </View>
                <View style={styles.actionsCol}>
                  <Text style={styles.checkmark}>✓</Text>
                  <Pressable onPress={() => onDelete(entry.id)} disabled={deletingId === entry.id}>
                    <Text style={styles.deleteText}>{deletingId === entry.id ? '...' : 'Delete'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addLink: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  formCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  formLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: C.navyBg,
    borderColor: `${C.navy}35`,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.ink2,
  },
  chipTextActive: {
    color: C.navy,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  dayCol: {
    width: 56,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase',
  },
  dayDate: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  centerCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.navy,
  },
  entryText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  checkmark: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  deleteText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
});
