import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Switch, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { smartBack } from '../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import {
  notificationsApi,
  NotificationItem,
  NotificationPreferences,
} from '../../src/api/notifications';
import { useSession } from '../../src/store/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function NotificationsScreen() {
  const router = useRouter();
  const { hasManagerAccess, hasLeadershipAccess } = useSession();
  const { bottomClearance } = useScreenInsets(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const queryClient = useQueryClient();

  type FilterCategory = 'ALL' | 'GATE' | 'CHAT' | 'REPAIRS' | 'NOTICES';
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    staleTime: 15_000,
  });

  const { data: prefData } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: notificationsApi.getPreferences,
    staleTime: 60_000,
  });

  const preferences: NotificationPreferences = prefData?.preferences || {
    gateAlerts: true,
    chatMessages: true,
    maintenanceUpdates: true,
    communityNotices: true,
    soundEnabled: true,
  };

  const updatePrefMutation = useMutation({
    mutationFn: (updates: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(updates),
    onSuccess: (res) => {
      queryClient.setQueryData(['notificationPreferences'], res);
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: { notifications?: NotificationItem[]; unreadCount?: number } | undefined) => {
        if (!old || !old.notifications) return old;
        const selected = old.notifications.find((n: NotificationItem) => n.id === id);
        return {
          ...old,
          notifications: old.notifications.map((n: NotificationItem) =>
            n.id === id ? { ...n, readStatus: true } : n
          ),
          unreadCount: selected && !selected.readStatus
            ? Math.max(0, (old.unreadCount || 0) - 1)
            : old.unreadCount || 0,
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: { notifications?: NotificationItem[]; unreadCount?: number } | undefined) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: NotificationItem) => ({ ...n, readStatus: true })),
          unreadCount: 0,
        };
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleMarkRead = async (id: string, metadata?: Record<string, unknown>) => {
    markReadMutation.mutate(id);

    if (metadata?.ticketId) {
      if (hasManagerAccess() || hasLeadershipAccess()) {
        router.push(`/manager/tickets/${metadata.ticketId}` as never);
      } else {
        router.push('/services/maintenance');
      }
    } else if (metadata?.visitorId) {
      if (hasManagerAccess()) {
        router.push('/manager/visitors' as never);
      } else {
        router.push('/visitors' as never);
      }
    } else if (metadata?.channelId) {
      router.push('/chat' as never);
    } else if (metadata?.announcementId || metadata?.spaceId) {
      router.push('/community' as never);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const defaultBackPath = hasManagerAccess()
    ? '/manager'
    : hasLeadershipAccess()
    ? '/leadership'
    : '/home';

  const notificationCategory = (type: string): Exclude<FilterCategory, 'ALL'> | null => {
    const normalized = type.toUpperCase();

    if (
      normalized.includes('GATE') ||
      normalized.includes('VISITOR') ||
      normalized.includes('DELIVERY') ||
      normalized.includes('HANDOFF')
    ) return 'GATE';
    if (normalized.includes('CHAT')) return 'CHAT';
    if (
      normalized.includes('TICKET') ||
      normalized.includes('TASK') ||
      normalized.includes('WORK_') ||
      normalized.includes('MAINTENANCE') ||
      normalized.includes('EMPLOYEE_') ||
      normalized.includes('STARTED') ||
      normalized.includes('IN_PROGRESS') ||
      normalized.includes('COMPLETED') ||
      normalized.includes('VERIFIED')
    ) return 'REPAIRS';
    if (
      normalized.includes('ANNOUNCEMENT') ||
      normalized.includes('SOS') ||
      normalized.includes('GENERAL') ||
      normalized.includes('NOTICE')
    ) return 'NOTICES';
    return null;
  };

  const displayedList = notifications.filter((n: NotificationItem) =>
    activeFilter === 'ALL' || notificationCategory(n.type) === activeFilter
  );

  const filterTabs: Array<{ key: FilterCategory; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { key: 'ALL', label: 'All', icon: 'inbox' },
    { key: 'GATE', label: 'Gate & Visitors', icon: 'shield' },
    { key: 'CHAT', label: 'Chat', icon: 'message-circle' },
    { key: 'REPAIRS', label: 'Repairs', icon: 'tool' },
    { key: 'NOTICES', label: 'Notices', icon: 'bell' },
  ];

  const getNotifIcon = (type: string) => {
    const normalized = type.toUpperCase();
    if (normalized.includes('SOS')) return { name: 'alert-triangle', ...theme.status.danger };
    if (normalized.includes('TICKET') || normalized.includes('MAINTENANCE')) return { name: 'tool', ...theme.status.warning };
    if (normalized.includes('TASK') || normalized.includes('EMPLOYEE_')) return { name: 'user-check', ...theme.status.info };
    if (normalized.includes('WORK_') || normalized.includes('COMPLETED') || normalized.includes('VERIFIED')) return { name: 'check-circle', ...theme.status.success };
    if (normalized.includes('CHAT')) return { name: 'message-circle', foreground: '#245C86', background: '#EAF2F8' };
    if (normalized.includes('GATE') || normalized.includes('VISITOR') || normalized.includes('DELIVERY') || normalized.includes('HANDOFF')) return { name: 'shield', foreground: theme.colors.primary, background: theme.colors.surfaceGreen };
    return { name: 'bell', foreground: theme.colors.primary, background: theme.colors.surfaceGreen };
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return <View style={styles.loadingState}><Skeleton height={80} borderRadius={18} /><Skeleton height={80} borderRadius={18} /><Skeleton height={80} borderRadius={18} /></View>;
    }
    if (isError) {
      return <EmptyState icon="wifi-off" title="Notifications unavailable" description="We couldn't load your notifications. Check your connection and try again." actionLabel="Try again" onAction={() => { void refetch(); }} />;
    }
    return <EmptyState icon="bell" title="No notifications" description="You're all caught up. New gate, chat, repair, and community updates will appear here." />;
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Notifications"
        onBackPress={() => smartBack(router, defaultBackPath as never)}
        rightAction={
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <PremiumPressable onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.markAllText}>Read All</Text>
              </PremiumPressable>
            )}
            <PremiumPressable
              onPress={() => setIsPreferencesOpen(true)}
              style={styles.settingsIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="sliders" size={17} color={theme.colors.textPrimary} />
            </PremiumPressable>
          </View>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsBar}
      >
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
            const count = tab.key === 'ALL'
              ? notifications.length
              : notifications.filter((n: NotificationItem) => notificationCategory(n.type) === tab.key).length;

          return (
            <PremiumPressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveFilter(tab.key)}
              scaleTo={0.96}
            >
              <Feather
                name={tab.icon}
                size={13}
                color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label} {count > 0 ? `(${count})` : ''}
              </Text>
            </PremiumPressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading || isError ? renderEmptyState() : displayedList.length > 0 ? (
          displayedList.map((notif: NotificationItem, index: number) => {
            const iconMeta = getNotifIcon(notif.type);
            const isUnread = !notif.readStatus;

            return (
              <ScreenEntrance key={notif.id} delay={40 + index * 30}>
                <PremiumPressable
                  style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                  onPress={() => handleMarkRead(notif.id, notif.metadata)}
                  scaleTo={0.98}
                >
                  <View style={[styles.iconWrap, { backgroundColor: iconMeta.background }]}>
                    <Feather name={iconMeta.name as keyof typeof Feather.glyphMap} size={18} color={iconMeta.foreground} />
                  </View>

                  <View style={styles.notifContent}>
                    <View style={styles.titleRow}>
                      <Text numberOfLines={2} style={[styles.title, isUnread && styles.titleUnread]}>{notif.title}</Text>
                      {isUnread && <Text style={styles.unreadLabel}>Unread</Text>}
                    </View>
                    <Text style={styles.message} numberOfLines={2}>{notif.message}</Text>
                    <Text style={styles.time}>
                      {new Date(notif.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </ScreenEntrance>
            );
          })
        ) : renderEmptyState()}
      </ScrollView>

      {/* Notification Preferences Modal */}
      <Modal
        visible={isPreferencesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPreferencesOpen(false)}
        statusBarTranslucent
      >
        <View style={[styles.modalOverlay, {
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
        }]}>
          <View style={[styles.modalSheet, {
            maxHeight: Math.max(0, Math.min(560, windowHeight - Math.max(insets.top, 20) - Math.max(insets.bottom, 20) - 40)),
          }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Notification Alerts</Text>
                <Text style={styles.modalSubtitle}>Manage push alerts & in-app channels</Text>
              </View>
              <PremiumPressable
                onPress={() => setIsPreferencesOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={20} color={theme.colors.textPrimary} />
              </PremiumPressable>
            </View>

            <ScrollView
              style={styles.prefScroll}
              contentContainerStyle={styles.prefList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.prefRow}>
                <View style={styles.prefLeft}>
                  <View style={[styles.prefIconWrap, { backgroundColor: theme.colors.surfaceGreen }]}>
                    <Feather name="shield" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.prefText}>
                    <Text numberOfLines={1} style={styles.prefLabel}>Gate & Visitor Arrivals</Text>
                    <Text numberOfLines={2} style={styles.prefDesc}>Deliveries, cabs, and unannounced guests</Text>
                  </View>
                </View>
                <Switch
                  value={preferences.gateAlerts}
                  onValueChange={(val) => updatePrefMutation.mutate({ gateAlerts: val })}
                  trackColor={{ false: '#E0E7E1', true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.prefRow}>
                <View style={styles.prefLeft}>
                  <View style={[styles.prefIconWrap, { backgroundColor: '#EAF2F8' }]}>
                    <Feather name="message-circle" size={18} color="#245C86" />
                  </View>
                  <View style={styles.prefText}>
                    <Text numberOfLines={1} style={styles.prefLabel}>Community & Unit Chat</Text>
                    <Text numberOfLines={2} style={styles.prefDesc}>Household, Owners, and Ops channel messages</Text>
                  </View>
                </View>
                <Switch
                  value={preferences.chatMessages}
                  onValueChange={(val) => updatePrefMutation.mutate({ chatMessages: val })}
                  trackColor={{ false: '#E0E7E1', true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.prefRow}>
                <View style={styles.prefLeft}>
                  <View style={[styles.prefIconWrap, { backgroundColor: '#FFF3DE' }]}>
                    <Feather name="tool" size={18} color="#875200" />
                  </View>
                  <View style={styles.prefText}>
                    <Text numberOfLines={1} style={styles.prefLabel}>Repairs & Maintenance</Text>
                    <Text numberOfLines={2} style={styles.prefDesc}>Ticket status updates and workforce arrival</Text>
                  </View>
                </View>
                <Switch
                  value={preferences.maintenanceUpdates}
                  onValueChange={(val) => updatePrefMutation.mutate({ maintenanceUpdates: val })}
                  trackColor={{ false: '#E0E7E1', true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.prefRow, styles.prefRowLast]}>
                <View style={styles.prefLeft}>
                  <View style={[styles.prefIconWrap, { backgroundColor: '#F4F6F1' }]}>
                    <Feather name="volume-2" size={18} color={theme.colors.textPrimary} />
                  </View>
                  <View style={styles.prefText}>
                    <Text numberOfLines={1} style={styles.prefLabel}>Sound & Haptics</Text>
                    <Text numberOfLines={2} style={styles.prefDesc}>Play sound and tactile pulse on arrival</Text>
                  </View>
                </View>
                <Switch
                  value={preferences.soundEnabled}
                  onValueChange={(val) => updatePrefMutation.mutate({ soundEnabled: val })}
                  trackColor={{ false: '#E0E7E1', true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>

            <PremiumPressable
              style={styles.doneBtn}
              onPress={() => setIsPreferencesOpen(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </PremiumPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#EAEFE8',
  },
  markAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 61, 42, 0.06)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  list: {
    padding: 16,
    paddingTop: 10,
  },
  loadingState: {
    gap: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  notifCardUnread: {
    backgroundColor: theme.colors.surfaceGreen,
    borderColor: theme.status.success.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notifContent: { flex: 1, paddingRight: 8 },
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  titleUnread: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  unreadLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.primary,
    marginLeft: 8,
  },
  message: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  time: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
  },
  prefList: {
    marginBottom: 20,
  },
  prefScroll: {
    flexShrink: 1,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F0F4F1',
  },
  prefRowLast: {
    borderBottomWidth: 0,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  prefText: {
    flex: 1,
    minWidth: 0,
  },
  prefIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prefLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  prefDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
