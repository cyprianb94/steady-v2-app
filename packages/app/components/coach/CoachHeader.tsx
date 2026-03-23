import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

export function CoachHeader() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Steady</Text>
      <Text style={styles.subtitle}>Your running coach</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: C.cream,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
});
