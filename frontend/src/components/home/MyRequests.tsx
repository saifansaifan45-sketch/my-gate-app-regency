import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Skeleton } from '../ui/Skeleton';
import { TicketItem } from '../../api/manager';
import { homeLayout } from './homeSurface';
import { theme } from '../../theme';

interface MyRequestsProps {
  requests: TicketItem[];
  loading?: boolean;
  error?: boolean;
  onPress: () => void;
}

const getStatusLabel = (status: TicketItem['status']) => {
  const labels: Record<TicketItem['status'], string> = {
    OPEN: 'Open',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    COMPLETED_BY_WORKER: 'Work completed',
    PENDING_RESIDENT_CONFIRMATION: 'Needs review',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
    CANCELLED: 'Cancelled',
  };
  return labels[status];
};

export const MyRequests: React.FC<MyRequestsProps> = ({ requests, loading = false, error = false, onPress }) => {
  const latestRequest = requests[0];
  const summary = `${requests.length} active request${requests.length === 1 ? '' : 's'}`;
  const title = error ? 'Requests unavailable' : latestRequest ? summary : 'All caught up';
  const description = error
    ? 'Pull to refresh and try again.'
    : latestRequest
      ? `${latestRequest.title} · ${getStatusLabel(latestRequest.status)}`
      : 'Your maintenance requests will appear here.';

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingCard} accessibilityLabel="Loading maintenance requests">
          <Skeleton width="36%" height={13} borderRadius={7} />
          <Skeleton width="62%" height={22} borderRadius={7} style={styles.loadingTitle} />
          <Skeleton width="82%" height={13} borderRadius={7} />
        </View>
      ) : (
        <PremiumPressable
          style={styles.card}
          onPress={onPress}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`My requests. ${title}. ${description}`}
        >
          <View style={styles.bgIllustrationContainer} pointerEvents="none">
            <Feather name="file-text" size={140} color="rgba(255, 255, 255, 0.07)" style={styles.bgIcon} />
          </View>

          <View style={styles.innerContent}>
            <View style={styles.iconContainer}>
              <Feather name={error ? 'alert-circle' : latestRequest ? 'file-text' : 'check-circle'} size={24} color="#FFFFFF" />
            </View>

            <View style={styles.textColumn}>
              <Text style={styles.cardHeaderSmall}>My requests</Text>
              <Text style={styles.statusTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.statusDescription} numberOfLines={2}>{description}</Text>
            </View>

            <View style={styles.actionLinkWrap}>
              <View style={styles.chevronBox}>
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </View>
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
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPadding,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  loadingCard: {
    backgroundColor: theme.colors.primary,
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
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textColumn: {
    flex: 1,
    paddingRight: 8,
  },
  cardHeaderSmall: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  statusDescription: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  actionLinkWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
