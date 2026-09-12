import React, { useEffect, useState } from 'react';
import { View, FlatList, TextInput, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../../src/components/ui/Text';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Button } from '../../../src/components/ui/Button';
import { chatApi, ChatChannel, ChatMessage } from '../../../src/api/chat';
import { theme } from '../../../src/theme';

export default function ChatScreen() {
  const queryClient = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [inputText, setInputText] = useState('');

  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: () => chatApi.getChannels(),
  });

  const channels: ChatChannel[] = channelsData?.channels || [];
  const activeChannel = channels.find((c) => c.channelId === activeChannelId) || channels[0];

  useEffect(() => {
    if (!activeChannelId && channels.length > 0) setActiveChannelId(channels[0].channelId);
  }, [channels, activeChannelId]);

  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ['chat-messages', activeChannel?.channelId],
    queryFn: () => (activeChannel ? chatApi.getMessages(activeChannel.channelId) : Promise.resolve({ messages: [] as ChatMessage[] })),
    enabled: !!activeChannel,
  });

  const handleSend = async () => {
    if (!activeChannel || !inputText.trim()) return;
    try {
      await chatApi.sendMessage(activeChannel.channelId, inputText.trim());
      setInputText('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChannel.channelId] });
      refetchMessages();
    } catch {}
  };

  if (channelsLoading) return <View style={styles.center}><Text>Loading channels…</Text></View>;

  return (
    <View style={styles.container}>
      <AppHeader title="Community Chat" subtitle={activeChannel?.name || 'Select channel'} />
      <View style={styles.channelRow}>
        {channels.slice(0, 3).map((ch) => (
          <Button key={ch.channelId} label={ch.name} variant={ch.channelId === activeChannel?.channelId ? 'primary' : 'secondary'} onPress={() => setActiveChannelId(ch.channelId)} style={{ marginRight: 8 }} />
        ))}
      </View>
      <FlatList
        data={messagesData?.messages || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{item.content}</Text>
            <Text style={styles.messageMeta}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 32, opacity: 0.6 }}>No messages yet. Start the conversation.</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput value={inputText} onChangeText={setInputText} placeholder="Type a message…" style={styles.input} placeholderTextColor={theme.colors.textSecondary} />
        <Button label="Send" onPress={handleSend} disabled={!inputText.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  channelRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  messageBubble: { backgroundColor: theme.colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 },
  messageText: { fontSize: 14 },
  messageMeta: { fontSize: 10, opacity: 0.5, marginTop: 4 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, alignItems: 'center' },
  input: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, fontSize: 14 },
});
