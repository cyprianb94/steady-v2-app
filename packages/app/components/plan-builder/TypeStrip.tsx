import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import type { SessionType } from '@steady/types';

interface TypeStripProps {
  selected: SessionType;
  onSelect: (type: SessionType) => void;
}

const TYPES: SessionType[] = ['EASY', 'INTERVAL', 'TEMPO', 'LONG', 'REST'];

export function TypeStrip({ selected, onSelect }: TypeStripProps) {
  return (
    <View style={styles.row}>
      {TYPES.map((t) => {
        const meta = SESSION_TYPE[t];
        const active = t === selected;
        return (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            style={[
              styles.chip,
              {
                borderColor: active ? meta.color : C.border,
                backgroundColor: active ? meta.bg : C.cream,
              },
            ]}
          >
            <Text style={[styles.emoji, { color: meta.color }]}>{meta.emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: active ? meta.color : C.muted, fontWeight: active ? '700' : '400' },
              ]}
            >
              {meta.abbr}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 13,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
