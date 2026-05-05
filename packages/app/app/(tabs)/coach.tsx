import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { STEADY_AI_FREEZE_MESSAGE, STEADY_AI_FREEZE_TITLE } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

export default function CoachTab() {
  return (
    <View style={styles.container}>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{STEADY_AI_FREEZE_TITLE}</Text>
        <Text style={styles.emptyBody}>{STEADY_AI_FREEZE_MESSAGE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
