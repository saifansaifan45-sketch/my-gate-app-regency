import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Skeleton } from '../ui/Skeleton';
import { homeLayout } from './homeSurface';
import { CommunityAnnouncement } from '../../api/community';
import { theme } from '../../theme';

import { useResponsive } from '../../hooks/useResponsive';

interface CommunityUpdatesProps {
  announcements: CommunityAnnouncement[];
  loading?: boolean;
  onViewAllPress: () => void;
  onAnnouncementPress?: (announcement: CommunityAnnouncement) => void;
  onCreateNotice?: () => void;
  currentUserId?: string;
}

function relativeTime(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function getPriorityBadge(priority?: string) {
  switch (priority) {
    case 'URGENT':
      return { label: 'Urgent', bg: '#FEE2E2', color: '#B91C1C', icon: 'alert-circle' as const };
    case 'IMPORTANT':
      return { label: 'Important', bg: '#FEF3C7', color: '#B45309', icon: 'alert-triangle' as const };
    default:
      return { label: 'Notice', bg: '#ECFDF5', color: '#047857', icon: 'volume-2' as const };
  }
}

export const CommunityUpdates: React.FC<CommunityUpdatesProps> = ({
  announcements,
  loading = false,
  onViewAllPress,
  onAnnouncementPress,
  onCreateNotice,
  currentUserId: _currentUserId,
}) => {
  const { pagePadding } = useResponsive();
  const latest = announcements[0];
  const count = announcements.length;
  const hasUnread = announcements.some((item) => !item.isRead);
  const badge = getPriorityBadge(latest?.priority);

  if (loading) {
    return (
      <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
        <View style={styles.skeletonCard} accessibilityLabel="Loading community updates">
          <View style={styles.skeletonTopRow}>
            <Skeleton width={80} height={20} borderRadius={6} />
            <Skeleton width={60} height={14} borderRadius={6} />
          </View>
          <Skeleton width="85%" height={20} borderRadius={6} style={{ marginTop: 10 }} />
          <Skeleton width="100%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
          <Skeleton width="60%" height={14} borderRadius={6} style={{ marginTop: 4 }} />
        </View>
      </View>
    );
  }

  // If no announcements are present
  if (!latest) {
    return (
      <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
        <PremiumPressable
          style={styles.emptyCard}
          onPress={onViewAllPress}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel="Community updates: No notices yet. View all."
        >
          <View style={styles.emptyLeftIcon}>
            <Feather name="bell" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.emptyTextCol}>
            <Text style={styles.emptyTitle}>Community Updates</Text>
            <Text style={styles.emptyDesc}>No new notices at this time</Text>
          </View>
          {onCreateNotice ? (
            <TouchableOpacity
              style={styles.createPillBtn}
              onPress={(e) => {
                e.stopPropagation();
                onCreateNotice();
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={13} color={theme.colors.primary} />
              <Text style={styles.createPillText}>Post</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyChevron}>
              <Feather name="chevron-right" size={16} color={theme.colors.textTertiary} />
            </View>
          )}
        </PremiumPressable>
      </View>
    );
  }

  const authorName = latest.author
    ? `${latest.author.firstName || ''} ${latest.author.lastName || ''}`.trim() || 'Township Admin'
    : 'Township Leadership';

  return (
    <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
      <PremiumPressable
        style={styles.card}
        onPress={() => (onAnnouncementPress ? onAnnouncementPress(latest) : onViewAllPress())}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Community update: ${latest.title}. ${latest.content}`}
      >
        {/* Top Meta Bar */}
        <View style={styles.cardHeader}>
          <View style={[styles.priorityPill, { backgroundColor: badge.bg }]}>
            <Feather name={badge.icon} size={12} color={badge.color} />
            <Text style={[styles.priorityPillText, { color: badge.color }]}>{badge.label}</Text>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.timeText}>{relativeTime(latest.createdAt)}</Text>
            {hasUnread && <View style={styles.unreadDot} />}
            {onCreateNotice && (
              <TouchableOpacity
                style={styles.createPillBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onCreateNotice();
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={12} color={theme.colors.primary} />
                <Text style={styles.createPillText}>New</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.bodySection}>
          <Text style={styles.noticeTitle} numberOfLines={1}>
            {latest.title}
          </Text>
          {Boolean(latest.content) && (
            <Text style={styles.noticeSnippet} numberOfLines={2}>
              {latest.content}
            </Text>
          )}
        </View>

        {/* Bottom Footer / Action Row */}
        <View style={styles.cardFooter}>
          <View style={styles.authorTag}>
            <Feather name="user" size={12} color={theme.colors.textTertiary} />
            <Text style={styles.authorText} numberOfLines={1}>
              {authorName}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewAllRow}
            onPress={(e) => {
              e.stopPropagation();
              onViewAllPress();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllText}>
              {count > 1 ? `View all (${count})` : 'Read notice'}
            </Text>
            <Feather name="arrow-right" size={13} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </PremiumPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
    width: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: '#F5F9F6',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'stretch',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    width: '100%',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textTertiary,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.error,
  },
  createPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(20, 61, 42, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  createPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.primary,
  },
  bodySection: {
    marginBottom: 12,
    width: '100%',
  },
  noticeTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  noticeSnippet: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18.5,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20, 61, 42, 0.05)',
    width: '100%',
  },
  authorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 10,
  },
  authorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textTertiary,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  emptyCard: {
    width: '100%',
    backgroundColor: '#F5F9F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyLeftIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 61, 42, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emptyTextCol: {
    flex: 1,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  emptyDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyChevron: {
    paddingLeft: 8,
  },
  skeletonCard: {
    backgroundColor: '#F5F9F6',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
