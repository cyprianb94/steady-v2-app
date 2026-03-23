import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export function MessageBubble({ role, content, time }: Props) {
  const isCoach = role === 'assistant';

  return (
    <View style={[styles.row, isCoach ? styles.rowLeft : styles.rowRight]}>
      <View
        style={[
          styles.bubble,
          isCoach ? styles.coachBubble : styles.userBubble,
        ]}
      >
        <Text style={styles.text}>{content}</Text>
        <Text style={[styles.time, isCoach ? styles.timeLeft : styles.timeRight]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '83%',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
  },
  coachBubble: {
    backgroundColor: C.card,
    borderColor: '#E0D8CE',
    borderRadius: 5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  userBubble: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  text: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink2,
    lineHeight: 22,
  },
  time: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: C.muted,
    marginTop: 4,
  },
  timeLeft: {
    textAlign: 'left',
  },
  timeRight: {
    textAlign: 'right',
  },
});
