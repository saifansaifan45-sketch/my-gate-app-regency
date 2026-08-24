import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
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
  const publishedList = announcements.slice(0, 1);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTitle}>Community updates</Text>
          {announcements.some((a) => !a.isRead) && <View style={styles.unreadBadgeDot} />}
        </View>
        <View style={styles.headerActions}>
          {onCreateNotice && (
            <PremiumPressable
              style={styles.createBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onCreateNotice}
              scaleTo={0.94}
            >
              <Feather name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create</Text>
            </PremiumPressable>
          )}
          <PremiumPressable
            style={styles.viewAllBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onViewAllPress}
            scaleTo={0.94}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <Feather name="chevron-right" size={15} color="#166534" />
          </PremiumPressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.card}>
          <Text style={styles.placeholderText}>Loading updates...</Text>
        </View>
      ) : publishedList.length > 0 ? (
        <View style={styles.cardStack}>
          {publishedList.map((item) => {
            const isUrgent = item.priority === 'URGENT';
            const isImportant = item.priority === 'IMPORTANT';
            const badgeBg = isUrgent ? '#FDEBEC' : isImportant ? '#FEF3D6' : '#EAF6EE';
            const badgeText = isUrgent ? '#B42318' : isImportant ? '#A46100' : '#1F7A45';

            return (
              <PremiumPressable
                key={item.id}
                style={styles.card}
                onPress={() => onAnnouncementPress ? onAnnouncementPress(item) : onViewAllPress()}
                scaleTo={0.98}
              >
                <View style={styles.metaRow}>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeText }]}>
                      {item.category || item.priority}
                    </Text>
                  </View>
                  <Text style={styles.timeText} numberOfLines={1}>
                    {!item.isRead ? 'New · ' : ''}{relativeTime(item.createdAt)}
                  </Text>
                </View>

                <Text style={styles.titleText} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.bodyText} numberOfLines={2}>
                  {item.content}
                </Text>
              </PremiumPressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Feather name="bell" size={20} color="#166534" />
          </View>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyTitle}>All quiet in your community</Text>
            <Text style={styles.emptySub}>Published notices from management will appear here.</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: homeLayout.headingSpacing,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: homeLayout.sectionTitle,
  unreadBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#166534',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  createBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  cardStack: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 97,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#9CA3AF',
  },
  titleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#6B7280',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  emptySub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});