import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';

type TabName = 'week' | 'block' | 'coach' | 'settings';

interface TabIconProps {
  name: TabName;
  focused: boolean;
}

export function TabIcon({ name, focused }: TabIconProps) {
  const color = focused ? C.clay : C.muted;

  switch (name) {
    case 'week':
      return (
        <View style={styles.container}>
          {/* 7-dot grid representing a week */}
          <View style={styles.weekGrid}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={[styles.weekDot, { backgroundColor: color }]} />
            ))}
          </View>
        </View>
      );
    case 'block':
      return (
        <View style={styles.container}>
          {/* Stacked bars representing block view */}
          {[16, 12, 8].map((w, i) => (
            <View key={i} style={[styles.blockBar, { width: w, backgroundColor: color }]} />
          ))}
        </View>
      );
    case 'coach':
      return (
        <View style={styles.container}>
          {/* Speech bubble */}
          <View style={[styles.bubble, { borderColor: color }]}>
            <View style={[styles.bubbleDot, { backgroundColor: color }]} />
            <View style={[styles.bubbleDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'settings':
      return (
        <View style={styles.container}>
          {/* Gear-like circle with dot */}
          <View style={[styles.settingsCircle, { borderColor: color }]}>
            <View style={[styles.settingsDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 20,
    gap: 2,
  },
  weekDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  blockBar: {
    height: 3,
    borderRadius: 1.5,
    marginVertical: 1,
  },
  bubble: {
    width: 20,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bubbleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  settingsCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
