import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
  currentUserId?: string;
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
  currentUserId,
}) => {
  const singleAnnouncement = announcements[0];
  const hasUnread = announcements.some((item) => !item.isRead);
  const title = singleAnnouncement ? singleAnnouncement.title : 'Nothing new';
  const description = singleAnnouncement
    ? `${hasUnread ? 'New' : singleAnnouncement.category || singleAnnouncement.priority} · ${relativeTime(singleAnnouncement.createdAt)}`
    : 'No notices yet.';

  // Check if this is a user-created announcement
  const isUserCreated = Boolean(singleAnnouncement?.author?.id && currentUserId && singleAnnouncement.author.id === currentUserId);

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
          style={[styles.card, isUserCreated && styles.userCreatedCard]}
          onPress={() => singleAnnouncement && onAnnouncementPress ? onAnnouncementPress(singleAnnouncement) : onViewAllPress()}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`Community updates. ${title}. ${description}`}
        >
          <View style={styles.bgIllustrationContainer} pointerEvents="none">
            <Feather name="bell" size={140} color="rgba(255, 255, 255, 0.07)" style={styles.bgIcon} />
          </View>

          {onCreateNotice ? (
            <TouchableOpacity
              style={styles.createButton}
              onPress={(e) => {
                e.stopPropagation();
                onCreateNotice();
              }}
              activeOpacity={0.8}
              accessibilityLabel="Create community notice"
            >
              <Feather name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.innerContent}>
            <View style={styles.iconContainer}>
              <Feather name={isUserCreated ? 'edit-3' : singleAnnouncement ? 'bell' : 'inbox'} size={26} color="#FFFFFF" />
            </View>

            <View style={styles.textColumn}>
              <Text style={[styles.cardHeaderSmall, isUserCreated && styles.userCreatedHeader]}>Community updates</Text>
              <Text style={[styles.statusTitle, isUserCreated && styles.userCreatedTitle]}>{title}</Text>
              <Text style={[styles.statusDescription, isUserCreated && styles.userCreatedDescription]}>{description}</Text>
            </View>

            <View style={styles.actionLinkWrap}>
              <Text style={[styles.actionLinkText, isUserCreated && styles.userCreatedActionLink]}>View updates</Text>
              <Feather name="chevron-right" size={15} color="#FFFFFF" />
            </View>
          </View>
        </PremiumPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
  },
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
  userCreatedCard: {
    backgroundColor: theme.colors.accent,
  },
  loadingCard: {
    backgroundColor: theme.colors.community,
    borderRadius: 16,
    minHeight: 82,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPadding,
    gap: 7,
  },
  loadingTitle: { opacity: 0.76 },
  bgIllustrationContainer: {
    position: 'absolute',
    right: -20,
    bottom: -35,
  },
  bgIcon: {
    opacity: 0.8,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
  },
  cardHeaderSmall: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  userCreatedHeader: {
    color: 'rgba(255, 255, 255, 0.78)',
  },
  statusTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  userCreatedTitle: {
    color: '#FFFFFF',
  },
  statusDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  userCreatedDescription: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  actionLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 2,
    paddingLeft: 6,
  },
  actionLinkText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userCreatedActionLink: {
    color: '#FFFFFF',
  },
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
  createButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
  },
});
