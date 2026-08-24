import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Skeleton } from '../ui/Skeleton';
import { TicketItem } from '../../api/manager';
import { homeLayout, homeSurface } from './homeSurface';

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

const formatCreatedAt = (createdAt: string) =>
  new Date(createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const MyRequests: React.FC<MyRequestsProps> = ({ requests, loading = false, error = false, onPress }) => {
  const requestSummary = `${requests.length} Active Request${requests.length === 1 ? '' : 's'}`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>My requests</Text>
        {!loading && !error && requests.length > 0 ? <Text style={styles.summary}>{requestSummary}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.loadingCard} accessibilityLabel="Loading maintenance requests">
          <Skeleton width="48%" height={16} borderRadius={7} />
          <Skeleton width="78%" height={14} borderRadius={7} style={styles.loadingLine} />
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={20} color="#B45309" />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Requests are unavailable</Text>
            <Text style={styles.emptyDescription}>Pull to refresh and try again.</Text>
          </View>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={20} color="#166534" />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No active requests</Text>
            <Text style={styles.emptyDescription}>Your maintenance requests will appear here.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {requests.slice(0, 2).map((request) => (
            <PremiumPressable
              key={request.id}
              style={styles.requestRow}
              onPress={onPress}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${request.title}, ${getStatusLabel(request.status)}`}
            >
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle} numberOfLines={1}>{request.title}</Text>
                <Text style={styles.requestDate}>{formatCreatedAt(request.createdAt)}</Text>
              </View>
              <View style={[styles.statusBadge, request.status === 'IN_PROGRESS' && styles.statusBadgeProgress, request.status === 'PENDING_RESIDENT_CONFIRMATION' && styles.statusBadgeReview]}>
                <Text style={[styles.statusText, request.status === 'IN_PROGRESS' && styles.statusTextProgress, request.status === 'PENDING_RESIDENT_CONFIRMATION' && styles.statusTextReview]}>
                  {getStatusLabel(request.status)}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color="#6B7280" />
            </PremiumPressable>
          ))}
          {requests.length > 2 ? (
            <PremiumPressable style={styles.viewAllButton} onPress={onPress} scaleTo={0.97}>
              <Text style={styles.viewAllText}>View all requests</Text>
              <Feather name="arrow-up-right" size={15} color="#166534" />
            </PremiumPressable>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: homeLayout.pagePadding, marginBottom: homeLayout.sectionSpacing },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: homeLayout.headingSpacing },
  sectionTitle: homeLayout.sectionTitle,
  summary: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: '#166534' },
  loadingCard: { ...homeSurface, padding: homeLayout.cardPadding },
  loadingLine: { marginTop: 10 },
  emptyState: { minHeight: 96, padding: homeLayout.cardPadding, ...homeLayout.emptyState, alignItems: 'center', gap: 8 },
  emptyCopy: { alignItems: 'center' },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#143D2A', marginBottom: 2 },
  emptyDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: '#6B7280', lineHeight: 18 },
  list: { ...homeSurface, padding: 0 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: homeLayout.cardPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(20, 61, 42, 0.07)' },
  requestCopy: { flex: 1 },
  requestTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#111827', marginBottom: 3 },
  requestDate: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#6B7280' },
  statusBadge: { backgroundColor: '#ECFDF5', borderRadius: 98, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeProgress: { backgroundColor: '#EFF6FF' },
  statusBadgeReview: { backgroundColor: '#FFF7ED' },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#166534' },
  statusTextProgress: { color: '#1D4ED8' },
  statusTextReview: { color: '#C2410C' },
  viewAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  viewAllText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: '#166534' },
});
