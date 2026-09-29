import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../../src/components/ui/Text';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { TypingIndicator } from '../../../src/components/chat/TypingIndicator';
import { theme } from '../../../src/theme';
import { useSession } from '../../../src/store/auth';
import { chatApi, ChatMessage } from '../../../src/api/chat';
import { chatSocket, SocketStatus, TypingEvent } from '../../../src/services/chatSocket';

interface ChannelTabItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  scopeBadge: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    user,
    hasOwnerAccess,
    hasLeadershipAccess,
    hasManagerAccess,
    hasResidentAccess,
    primaryResidency,
    primaryOwnership,
  } = useSession();

  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [activeTypers, setActiveTypers] = useState<TypingEvent[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Query channels
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ['chat', 'channels'],
    queryFn: () => chatApi.getChannels(),
  });

  const channels = channelsData?.channels ?? [];

  // Available channel tabs based on role permissions
  const availableTabs: ChannelTabItem[] = useMemo(() => {
    return channels.map((ch) => ({
      key: ch.channelId,
      label: ch.name,
      icon: ch.channelType === 'UNIT' ? 'home' : (ch.channelType === 'OWNERS' ? 'key' : 'shield'),
      description: ch.description || '',
      scopeBadge: ch.channelType === 'UNIT' ? 'Household' : (ch.channelType === 'OWNERS' ? 'Owners' : 'Ops'),
    }));
  }, [channels]);

  // Ensure active tab is within available tabs
  useEffect(() => {
    if (availableTabs.length > 0) {
      if (!activeChannelId || !availableTabs.some((t) => t.key === activeChannelId)) {
        setActiveChannelId(availableTabs[0].key);
      }
    }
  }, [availableTabs, activeChannelId]);

  // Query message history for active channel
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['chat', 'messages', activeChannelId],
    queryFn: () => activeChannelId ? chatApi.getMessages({ channelId: activeChannelId }) : Promise.resolve({ messages: [] }),
    staleTime: 5000,
    enabled: !!activeChannelId,
  });

  const messages: ChatMessage[] = useMemo(() => {
    return messagesData?.messages ?? [];
  }, [messagesData]);

  // Connect socket and listen to events
  useEffect(() => {
    chatSocket.connect();
    const unsubStatus = chatSocket.onStatus((status) => {
      setSocketStatus(status);
    });

    const unsubMessages = chatSocket.onMessage((newMsg) => {
      if (newMsg.channelId === activeChannelId) {
        queryClient.setQueryData<{ messages: ChatMessage[] }>(
          ['chat', 'messages', activeChannelId],
          (old) => {
            const current = old?.messages ?? [];
            const exists = current.some(
              (m) => m.id === newMsg.id || (newMsg.tempId && m.tempId === newMsg.tempId)
            );
            if (exists) {
              return {
                messages: current.map((m) =>
                  m.id === newMsg.id || (newMsg.tempId && m.tempId === newMsg.tempId) ? newMsg : m
                ),
              };
            }
            return { messages: [...current, newMsg] };
          }
        );
      }
    });

    const unsubTyping = chatSocket.onTyping((event) => {
      if (event.channelId === activeChannelId && event.userId !== user?.id) {
        setActiveTypers((prev) => {
          if (event.isTyping) {
            const filtered = prev.filter((t) => t.userId !== event.userId);
            return [...filtered, event];
          } else {
            return prev.filter((t) => t.userId !== event.userId);
          }
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMessages();
      unsubTyping();
    };
  }, [activeChannelId, queryClient, user?.id]);

  // Switch channel room in socket
  useEffect(() => {
    if (activeChannelId) chatSocket.joinChannel(activeChannelId);
    setActiveTypers([]);
    return () => {
      if (activeChannelId) chatSocket.leaveChannel(activeChannelId);
    };
  }, [activeChannelId]);

  // Handle typing debounce
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (activeChannelId) chatSocket.setTyping(activeChannelId, true);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeChannelId) chatSocket.setTyping(activeChannelId, false);
    }, 2000);
  };

  const [isSending, setIsSending] = useState(false);

  // Send message handler with optimistic UI & haptic feedback
  const handleSendMessage = async (textToSend?: string) => {
    if (isSending) return;
    
    const raw = (textToSend ?? inputText).trim();
    if (!raw) return;

    // Trigger haptic response on supported devices
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptics error on web
    }

    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const userUnit = primaryResidency?.unitNumber || primaryOwnership?.unitNumber || user?.unitNumber || '';
    const userRole = user?.role || 'RESIDENT';
    const userName = user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'You';

    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      channelId: activeChannelId,
      senderId: user?.id || 'current-user',
      senderName: userName,
      senderUnit: userUnit ? `Unit ${userUnit}` : undefined,
      senderRole: userRole,
      content: raw,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    // Optimistically update local query cache
    queryClient.setQueryData<{ messages: ChatMessage[] }>(
      ['chat', 'messages', activeChannelId],
      (old) => ({
        messages: [...(old?.messages ?? []), optimisticMessage],
      })
    );

    if (!textToSend) {
      setInputText('');
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (activeChannelId) chatSocket.setTyping(activeChannelId, false);

    // Backup HTTP sync
    try {
      const response = await chatApi.sendMessage({
        channelId: activeChannelId,
        content: raw,
        tempId,
      });

      queryClient.setQueryData<{ messages: ChatMessage[] }>(
        ['chat', 'messages', activeChannelId],
        (old) => {
          const current = old?.messages ?? [];
          return {
            messages: current.map((m) =>
              m.tempId === tempId || m.id === tempId ? { ...response.message, status: 'sent' } : m
            ),
          };
        }
      );
    } catch {
      // Mark as failed if send failed
      queryClient.setQueryData<{ messages: ChatMessage[] }>(
        ['chat', 'messages', activeChannelId],
        (old) => {
          const current = old?.messages ?? [];
          return {
            messages: current.map((m) =>
              m.tempId === tempId || m.id === tempId ? { ...m, status: 'failed' } : m
            ),
          };
        }
      );
    } finally {
      setIsSending(false);
    }
  };

  const activeChannelConfig = availableTabs.find((t) => t.key === activeChannelId) || availableTabs[0] || { label: '', description: '' };

  const renderStatusBadge = () => {
    let bg = theme.status.success.background;
    let fg = theme.status.success.foreground;
    let text = 'Connected';
    let dotColor = '#256B43';

    if (socketStatus === 'reconnecting') {
      bg = theme.status.warning.background;
      fg = theme.status.warning.foreground;
      text = 'Connecting';
      dotColor = '#D97706';
    } else if (socketStatus === 'disconnected') {
      bg = theme.status.danger.background;
      fg = theme.status.danger.foreground;
      text = 'Offline';
      dotColor = '#DC2626';
    }

    return (
      <View style={[styles.statusPill, { backgroundColor: bg }]}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: fg }]}>{text}</Text>
      </View>
    );
  };

  const renderMessageItem = ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
    const isMe = item.senderId === user?.id || item.senderId === 'current-user' || item.senderName === 'You';
    const prevMessage = index > 0 ? messages[index - 1] : null;

    // Date separator helper
    const messageDate = new Date(item.createdAt);
    const prevDate = prevMessage ? new Date(prevMessage.createdAt) : null;
    const isDifferentDay =
      !prevDate ||
      messageDate.getDate() !== prevDate.getDate() ||
      messageDate.getMonth() !== prevDate.getMonth() ||
      messageDate.getFullYear() !== prevDate.getFullYear();

    const formattedDate = isDifferentDay
      ? messageDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

    const formattedTime = messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <View style={styles.messageRowWrapper}>
        {formattedDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formattedDate}</Text>
            <View style={styles.dateLine} />
          </View>
        )}

        <View style={[styles.messageBubbleContainer, isMe ? styles.bubbleMeAlign : styles.bubbleOtherAlign]}>
          {!isMe && (
            <View style={styles.senderHeaderRow}>
              <Text style={styles.senderNameText}>{item.senderName}</Text>
              {item.senderUnit && <Text style={styles.senderUnitBadge}>{item.senderUnit}</Text>}
              {item.senderRole && item.senderRole !== 'RESIDENT' && (
                <Text style={styles.senderRoleBadge}>{item.senderRole}</Text>
              )}
            </View>
          )}

          <View style={[styles.bubbleCard, isMe ? styles.bubbleMeCard : styles.bubbleOtherCard]}>
            <Text style={[styles.bubbleContentText, isMe ? styles.bubbleMeText : styles.bubbleOtherText]}>
              {item.content}
            </Text>

            <View style={[styles.bubbleMetaRow, isMe ? styles.bubbleMetaMe : styles.bubbleMetaOther]}>
              <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                {formattedTime}
              </Text>
              {isMe && (
                <View style={styles.deliveryStatusIcon}>
                  {item.status === 'sending' ? (
                    <Feather name="clock" size={11} color="rgba(255,255,255,0.7)" />
                  ) : item.status === 'failed' ? (
                    <Feather name="alert-circle" size={11} color="#FFD0CC" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Feather name="check" size={11} color="rgba(255,255,255,0.9)" />
                      <Feather name="check" size={11} color="rgba(255,255,255,0.9)" style={{ marginLeft: -6 }} />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const quickPrompts = [
    'Good morning neighbors! 👋',
    'Package collected downstairs 📦',
    'Maintenance update requested 🛠️',
    'Thank you! 🙏',
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Community Chat"
        rightAction={renderStatusBadge()}
      />

      {/* Channel Switcher Tabs with Spring Indicator */}
      <View style={styles.channelBar}>
        {availableTabs.map((tab) => {
          const isActive = tab.key === activeChannelId;
          return (
            <PremiumPressable
              key={tab.key}
              onPress={() => setActiveChannelId(tab.key)}
              style={[styles.channelTabBtn, isActive && styles.channelTabBtnActive]}
            >
              <Feather
                name={tab.icon}
                size={14}
                color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.channelTabLabel,
                  isActive ? styles.channelTabLabelActive : styles.channelTabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </PremiumPressable>
          );
        })}
      </View>

      {/* Active Channel Info Subtitle */}
      <View style={styles.channelInfoBanner}>
        <Feather name="info" size={13} color={theme.colors.community} style={{ marginRight: 6 }} />
        <Text style={styles.channelInfoText} numberOfLines={1}>
          {activeChannelConfig.description}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Chat Message Stream */}
        {isLoadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="message-square"
              title={`No messages in ${activeChannelConfig.label}`}
              description="Be the first to start the conversation with your community members."
            />
            <View style={styles.quickPromptsPromptRow}>
              <Text style={styles.quickPromptsLabel}>Quick start suggestions:</Text>
              <View style={styles.promptsGrid}>
                {quickPrompts.map((prompt) => (
                  <PremiumPressable
                    key={prompt}
                    style={styles.promptChip}
                    onPress={() => handleSendMessage(prompt)}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </PremiumPressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id || item.tempId || String(Math.random())}
            renderItem={renderMessageItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            refreshing={isLoadingMessages}
            onRefresh={refetchMessages}
          />
        )}

        {/* Fluid 3-Dot Bouncing Wave Typing Indicator */}
        {activeTypers.length > 0 && (
          <TypingIndicator typerNames={activeTypers.map((t) => t.userName)} />
        )}

        {/* Bottom Input Area */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              placeholder={`Message ${activeChannelConfig.label}...`}
              placeholderTextColor="#8F9E96"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              returnKeyType="default"
              editable={!isSending}
              onSubmitEditing={() => !isSending && handleSendMessage()}
            />
            <PremiumPressable
              style={[
                styles.sendBtn,
                (!inputText.trim() || isSending) && styles.sendBtnDisabled,
              ]}
              disabled={!inputText.trim() || isSending}
              onPress={() => handleSendMessage()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="send"
                size={17}
                color={inputText.trim() ? '#FFFFFF' : '#9EB0A6'}
              />
            </PremiumPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.1,
  },
  channelBar: {
    flexDirection: 'row',
    backgroundColor: '#EAEFE8',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  channelTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    minHeight: 38,
  },
  channelTabBtnActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  channelTabLabel: {
    fontSize: 13,
  },
  channelTabLabelActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  channelTabLabelInactive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.textSecondary,
  },
  channelInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: '#EDF4EE',
    borderBottomWidth: 1,
    borderColor: '#E2ECE4',
    marginTop: 6,
  },
  channelInfoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  quickPromptsPromptRow: {
    width: '100%',
    marginTop: 20,
  },
  quickPromptsLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  promptChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  promptChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageRowWrapper: {
    marginBottom: 10,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E7E1',
  },
  dateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageBubbleContainer: {
    maxWidth: '82%',
  },
  bubbleMeAlign: {
    alignSelf: 'flex-end',
  },
  bubbleOtherAlign: {
    alignSelf: 'flex-start',
  },
  senderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    marginLeft: 6,
    gap: 6,
  },
  senderNameText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  senderUnitBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: theme.colors.community,
    backgroundColor: '#E8F2EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  senderRoleBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
    backgroundColor: '#F9EDE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bubbleCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMeCard: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleOtherCard: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E6ECE6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleContentText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleMeText: {
    color: '#FFFFFF',
  },
  bubbleOtherText: {
    color: theme.colors.textPrimary,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  bubbleMetaMe: {
    justifyContent: 'flex-end',
  },
  bubbleMetaOther: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
  },
  timeTextMe: {
    color: 'rgba(255,255,255,0.75)',
  },
  timeTextOther: {
    color: theme.colors.textTertiary,
  },
  deliveryStatusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderColor: '#E5EBE6',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DFE7E1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5ECE7',
  },
});
