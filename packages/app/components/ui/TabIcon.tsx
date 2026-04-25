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
          {/* Sliders icon from the settings icon pack */}
          <View style={styles.settingsGlyph}>
            <View style={[styles.settingsLine, styles.settingsTopLeft, { backgroundColor: color }]} />
            <View style={[styles.settingsLine, styles.settingsTopRight, { backgroundColor: color }]} />
            <View style={[styles.settingsLine, styles.settingsBottomLeft, { backgroundColor: color }]} />
            <View style={[styles.settingsLine, styles.settingsBottomRight, { backgroundColor: color }]} />
            <View style={[styles.settingsKnob, styles.settingsTopKnob, { borderColor: color }]} />
            <View style={[styles.settingsKnob, styles.settingsBottomKnob, { borderColor: color }]} />
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
  settingsGlyph: {
    width: 24,
    height: 24,
  },
  settingsLine: {
    position: 'absolute',
    height: 1.5,
    borderRadius: 0.75,
  },
  settingsTopLeft: {
    left: 4,
    top: 7.25,
    width: 4.25,
  },
  settingsTopRight: {
    left: 11.75,
    top: 7.25,
    width: 8.25,
  },
  settingsBottomLeft: {
    left: 4,
    top: 15.25,
    width: 10.25,
  },
  settingsBottomRight: {
    left: 17.75,
    top: 15.25,
    width: 2.25,
  },
  settingsKnob: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
  },
  settingsTopKnob: {
    left: 7.5,
    top: 5.5,
  },
  settingsBottomKnob: {
    left: 13.5,
    top: 13.5,
  },
});
