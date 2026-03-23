import { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function CoachInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Steady…"
          placeholderTextColor={C.muted}
          multiline
          maxLength={2000}
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || disabled) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || disabled}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 34,
    backgroundColor: C.cream,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
  sendText: {
    color: C.cream,
    fontSize: 18,
    fontWeight: '600',
    marginTop: -2,
  },
});
