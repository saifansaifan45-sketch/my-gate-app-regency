import React, { useState, useEffect, useCallback } from 'react';
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

export default function NotificationsScreen() {
  const router = useRouter();
  const { hasManagerAccess, hasLeadershipAccess } = useSession();
  const { bottomClearance } = useScreenInsets(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkRead = async (id: string, metadata?: any) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readStatus: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (metadata?.ticketId) {
        if (hasManagerAccess() || hasLeadershipAccess()) {
          router.push(`/manager/tickets/${metadata.ticketId}` as any);
        } else {
          router.push('/services/maintenance');
        }
      }
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const displayedList =
    activeFilter === 'UNREAD' ? notifications.filter((n) => !n.readStatus) : notifications;

  const getNotifIcon = (type: string) => {
    if (type === 'EMERGENCY_SOS') return { name: 'alert-triangle', color: '#DC2626', bg: '#FEE2E2' };
    if (type.includes('TICKET_CREATED')) return { name: 'alert-circle', color: '#D97706', bg: '#FEF3C7' };
    if (type.includes('TASK_ASSIGNED')) return { name: 'user-check', color: '#2563EB', bg: '#EFF6FF' };
    if (type.includes('IN_PROGRESS') || type.includes('STARTED')) return { name: 'tool', color: '#7C3AED', bg: '#F5F3FF' };
    if (type.includes('COMPLETED') || type.includes('VERIFIED')) return { name: 'check-circle', color: '#059669', bg: '#ECFDF5' };
    return { name: 'bell', color: theme.colors.primary, bg: '#ECFDF5' };
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Notifications"
        onBackPress={() => smartBack(router, '/home')}
        rightAction={
          unreadCount > 0 ? (
            <PremiumPressable onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.markAllText}>Read All</Text>
            </PremiumPressable>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <View style={styles.tabsBar}>
        <PremiumPressable
          style={[styles.tab, activeFilter === 'ALL' && styles.tabActive]}
          onPress={() => setActiveFilter('ALL')}
        >
          <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActive]}>
            All ({notifications.length})
          </Text>
        </PremiumPressable>

        <PremiumPressable
          style={[styles.tab, activeFilter === 'UNREAD' && styles.tabActive]}
          onPress={() => setActiveFilter('UNREAD')}
        >
          <Text style={[styles.tabText, activeFilter === 'UNREAD' && styles.tabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
          </View>
        ) : displayedList.length > 0 ? (
          displayedList.map((notif, index) => {
            const iconMeta = getNotifIcon(notif.type);
            const isUnread = !notif.readStatus;

            return (
              <ScreenEntrance key={notif.id} delay={40 + index * 30}>
                <PremiumPressable
                  style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                  onPress={() => handleMarkRead(notif.id, notif.metadata)}
                >
                  <View style={[styles.iconWrap, { backgroundColor: iconMeta.bg }]}>
                    <Feather name={iconMeta.name as any} size={18} color={iconMeta.color} />
                  </View>

                  <View style={styles.notifContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, isUnread && styles.titleUnread]}>{notif.title}</Text>
                      {isUnread && <View style={styles.unreadDot} />}
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  markAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 98,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabTextActive: { color: '#FFFFFF' },
  list: { padding: 20, paddingTop: 14 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  notifCardUnread: {
    backgroundColor: '#FAFDFB',
    borderColor: 'rgba(20, 61, 42, 0.15)',
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginLeft: 6,
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
