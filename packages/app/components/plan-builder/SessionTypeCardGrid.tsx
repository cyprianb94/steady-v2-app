import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SessionType } from '@steady/types';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';

const SESSION_TYPE_COPY: Record<SessionType, { label: string; caption: string }> = {
  EASY: { label: 'Easy', caption: 'Conversational' },
  RECOVERY: { label: 'Recovery', caption: 'Very gentle' },
  INTERVAL: { label: 'Interval', caption: 'Reps + recovery' },
  TEMPO: { label: 'Tempo', caption: 'Sustained quality' },
  LONG: { label: 'Long', caption: 'Distance day' },
  REST: { label: 'Rest', caption: 'Off day' },
};

interface SessionTypeCardGridProps {
  value: SessionType;
  types: SessionType[];
  onChange: (type: SessionType) => void;
}

export function SessionTypeCardGrid({ value, types, onChange }: SessionTypeCardGridProps) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.label}>Session type</Text>
        <Text style={styles.helper}>What kind of run is this?</Text>
      </View>
      <View style={styles.grid}>
        {types.map((type) => {
          const selected = value === type;
          const meta = SESSION_TYPE[type];
          const copy = SESSION_TYPE_COPY[type];
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) {
                  triggerSelectionChangeHaptic();
                }
                onChange(type);
              }}
              style={({ pressed }) => [
                styles.card,
                selected && {
                  borderColor: meta.color,
                  backgroundColor: meta.bg,
                },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.titleRow}>
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.title,
                    selected && { color: meta.color },
                  ]}
                >
                  {copy.label}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.caption}>{copy.caption}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
  },
  helper: {
    flexShrink: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  card: {
    width: '32%',
    minWidth: 0,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    gap: 6,
  },
  cardPressed: {
    opacity: 0.78,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  title: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
  },
  caption: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: C.muted,
  },
});
