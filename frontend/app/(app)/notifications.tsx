import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
import { notificationsApi, NotificationItem } from '../../src/api/notifications';
import { useSession } from '../../src/store/auth';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function NotificationsScreen() {
  const router = useRouter();
  const { hasManagerAccess, hasLeadershipAccess } = useSession();
  const { bottomClearance } = useScreenInsets(false);
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    staleTime: 15_000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: NotificationItem) =>
            n.id === id ? { ...n, readStatus: true } : n
          ),
          unreadCount: Math.max(0, old.unreadCount - 1),
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
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
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

  const handleMarkRead = async (id: string, metadata?: any) => {
    markReadMutation.mutate(id);

    if (metadata?.ticketId) {
      if (hasManagerAccess() || hasLeadershipAccess()) {
        router.push(`/manager/tickets/${metadata.ticketId}` as any);
      } else {
        router.push('/services/maintenance');
      }
    } else if (metadata?.visitorId) {
      if (hasManagerAccess()) {
        router.push('/manager/visitors' as any);
      } else {
        router.push('/visitors' as any);
      }
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const defaultBackPath = hasManagerAccess()
    ? '/manager/index'
    : hasLeadershipAccess()
    ? '/leadership/index'
    : '/home';

  const displayedList =
    activeFilter === 'UNREAD' ? notifications.filter((n: NotificationItem) => !n.readStatus) : notifications;

  const getNotifIcon = (type: string) => {
    if (type === 'EMERGENCY_SOS') return { name: 'alert-triangle', ...theme.status.danger };
    if (type.includes('TICKET_CREATED')) return { name: 'alert-circle', ...theme.status.warning };
    if (type.includes('TASK_ASSIGNED')) return { name: 'user-check', ...theme.status.info };
    if (type.includes('IN_PROGRESS') || type.includes('STARTED')) return { name: 'tool', ...theme.status.info };
    if (type.includes('COMPLETED') || type.includes('VERIFIED')) return { name: 'check-circle', ...theme.status.success };
    return { name: 'bell', foreground: theme.colors.primary, background: theme.colors.surfaceGreen };
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Notifications"
        onBackPress={() => smartBack(router, defaultBackPath as any)}
        rightAction={
          unreadCount > 0 ? (
            <PremiumPressable onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.markAllText}>Read All</Text>
            </PremiumPressable>
          ) : undefined
        }
      />

      <View style={styles.tabsBar}>
        <PremiumPressable
          style={[styles.tab, activeFilter === 'ALL' && styles.tabActive]}
          onPress={() => setActiveFilter('ALL')}
          scaleTo={0.96}
        >
          <Feather
            name="inbox"
            size={13}
            color={activeFilter === 'ALL' ? '#FFFFFF' : theme.colors.textSecondary}
          />
          <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActive]}>
            All ({notifications.length})
          </Text>
        </PremiumPressable>

        <PremiumPressable
          style={[styles.tab, activeFilter === 'UNREAD' && styles.tabActive]}
          onPress={() => setActiveFilter('UNREAD')}
          scaleTo={0.96}
        >
          <Feather
            name="bell"
            size={13}
            color={activeFilter === 'UNREAD' ? '#FFFFFF' : theme.colors.textSecondary}
          />
          <Text style={[styles.tabText, activeFilter === 'UNREAD' && styles.tabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
          </View>
        ) : displayedList.length > 0 ? (
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
                    <Feather name={iconMeta.name as any} size={18} color={iconMeta.foreground} />
                  </View>

                  <View style={styles.notifContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, isUnread && styles.titleUnread]}>{notif.title}</Text>
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
        ) : (
          <EmptyState
            icon="bell"
            title="No notifications"
            description="You're all caught up! New complaints, status changes, and task assignments will appear here."
          />
        )}
      </ScrollView>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
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
});
