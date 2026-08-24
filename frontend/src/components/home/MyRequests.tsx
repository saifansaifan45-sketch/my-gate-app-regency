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
          <View style={styles.backgroundIcon} pointerEvents="none">
            <Feather name="tool" size={136} color="rgba(255, 255, 255, 0.07)" />
          </View>
          <View style={styles.content}>
            <View style={styles.iconBox}>
              <Feather name={error ? 'alert-circle' : latestRequest ? 'tool' : 'check-circle'} size={24} color={theme.colors.onPrimary} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>My requests</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.description} numberOfLines={1}>{description}</Text>
            </View>
            <View style={styles.action}>
              <Text style={styles.actionText}>View requests</Text>
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
});
