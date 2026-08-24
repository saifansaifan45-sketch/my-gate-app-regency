import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Skeleton } from '../ui/Skeleton';
import { homeLayout } from './homeSurface';
import { CommunityAnnouncement } from '../../api/community';
import { theme } from '../../theme';

interface CommunityUpdatesProps {
  announcements: CommunityAnnouncement[];
  loading?: boolean;
  onViewAllPress: () => void;
  onAnnouncementPress?: (announcement: CommunityAnnouncement) => void;
  onCreateNotice?: () => void;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export const CommunityUpdates: React.FC<CommunityUpdatesProps> = ({
  announcements,
  loading = false,
  onViewAllPress,
  onAnnouncementPress,
  onCreateNotice,
}) => {
  const announcement = announcements[0];
  const hasUnread = announcements.some((item) => !item.isRead);
  const title = announcement ? announcement.title : 'All quiet in your community';
  const description = announcement
    ? `${hasUnread ? 'New update' : announcement.category || announcement.priority} - ${relativeTime(announcement.createdAt)}`
    : 'Published notices from management will appear here.';

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingCard} accessibilityLabel="Loading community updates">
          <Skeleton width="36%" height={13} borderRadius={7} />
          <Skeleton width="72%" height={22} borderRadius={7} style={styles.loadingTitle} />
          <Skeleton width="56%" height={13} borderRadius={7} />
        </View>
      ) : (
        <PremiumPressable
          style={[styles.card, onCreateNotice && styles.cardWithCreate]}
          onPress={() => announcement && onAnnouncementPress ? onAnnouncementPress(announcement) : onViewAllPress()}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`Community updates. ${title}. ${description}`}
        >
          <View style={styles.backgroundIcon} pointerEvents="none">
            <Feather name="bell" size={136} color="rgba(255, 255, 255, 0.07)" />
          </View>
          {onCreateNotice ? (
            <PremiumPressable style={styles.createButton} onPress={onCreateNotice} scaleTo={0.94} accessibilityLabel="Create community notice">
              <Feather name="plus" size={14} color={theme.colors.onPrimary} />
              <Text style={styles.createButtonText}>Create</Text>
            </PremiumPressable>
          ) : null}
          <View style={styles.content}>
            <View style={styles.iconBox}>
              <Feather name={announcement ? 'bell' : 'check-circle'} size={24} color={theme.colors.onPrimary} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>Community updates</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.description} numberOfLines={1}>{description}</Text>
            </View>
            <View style={styles.action}>
              <Text style={styles.actionText}>View updates</Text>
              <Feather name="chevron-right" size={15} color={theme.colors.onPrimary} />
            </View>
          </View>
        </PremiumPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: homeLayout.pagePadding, marginBottom: homeLayout.sectionSpacing },
  card: {
    backgroundColor: theme.colors.community,
    borderRadius: 16,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPadding,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.community,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  cardWithCreate: { paddingRight: 80 },
  loadingCard: {
    backgroundColor: theme.colors.community,
    borderRadius: 16,
    minHeight: 82,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPadding,
    gap: 7,
  },
  loadingTitle: { opacity: 0.76 },
  backgroundIcon: { position: 'absolute', right: -18, bottom: -36 },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20, lineHeight: 26, color: theme.colors.onPrimary, letterSpacing: -0.4, marginBottom: 3 },
  description: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: 'rgba(255, 255, 255, 0.75)' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6 },
  actionText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: 'rgba(255, 255, 255, 0.9)' },
  createButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  createButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: theme.colors.onPrimary },
});
