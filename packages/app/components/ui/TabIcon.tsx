import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';

type TabName = 'home' | 'block' | 'settings';

interface TabIconProps {
  name: TabName;
  focused: boolean;
}

export function TabIcon({ name, focused }: TabIconProps) {
  const color = focused ? C.clay : C.muted;

  switch (name) {
    case 'home':
      return (
        <View style={styles.container}>
          {/* House icon: triangle roof + square base */}
          <View style={[styles.homeRoof, { borderBottomColor: color }]} />
          <View style={[styles.homeBase, { backgroundColor: color }]} />
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
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBase: {
    width: 14,
    height: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  blockBar: {
    height: 3,
    borderRadius: 1.5,
    marginVertical: 1,
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
