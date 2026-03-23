import { useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { CoachHeader } from '../../components/coach/CoachHeader';
import { MessageBubble } from '../../components/coach/MessageBubble';
import { CoachInput } from '../../components/coach/CoachInput';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { trpc } from '../../lib/trpc';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function CoachTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const result = await trpc.coach.send.mutate({
          conversationId,
          message: text,
        });
        setConversationId(result.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            id: result.reply.id,
            role: 'assistant',
            content: result.reply.content,
            createdAt: result.reply.createdAt,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, I couldn\'t connect. Make sure the server is running.',
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [conversationId],
  );

  return (
    <View style={styles.container}>
      <CoachHeader />

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chat with Steady</Text>
          <Text style={styles.emptyBody}>
            Ask about your training plan, pacing, recovery, or anything running-related.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <MessageBubble
              role={item.role}
              content={item.content}
              time={formatTime(item.createdAt)}
            />
          )}
          ListFooterComponent={
            sending ? (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={C.muted} />
                <Text style={styles.typingText}>Steady is thinking…</Text>
              </View>
            ) : null
          }
        />
      )}

      <CoachInput onSend={handleSend} disabled={sending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  list: {
    padding: 16,
    paddingBottom: 8,
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
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
});
