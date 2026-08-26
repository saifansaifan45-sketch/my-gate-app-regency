import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TextInput as RNTextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitorsApi, VisitorStatus, VisitorItem } from '../../../src/api/visitors';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { Button } from '../../../src/components/ui/Button';
import { theme } from '../../../src/theme';
import { smartBack } from '../../../src/navigation/history';
import { cardSystem } from '../../../src/components/ui/cardSystem';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { GateVisitorCard } from '../../../src/components/gate/GateVisitorCard';
import { AddVisitorModal } from '../../../src/components/add-visitor-modal';

const STATUS_META: Record<VisitorStatus, { bg: string; text: string; label: string; dot: string }> = {
  PENDING: { bg: '#FFF7ED', text: '#C2410C', label: 'Pending Auth', dot: '#F97316' },
  APPROVED: { bg: '#ECFDF5', text: '#047857', label: 'Expected', dot: '#10B981' },
  CHECKED_IN: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Inside', dot: '#3B82F6' },
  CHECKED_OUT: { bg: '#F3F4F6', text: '#6B7280', label: 'Completed', dot: '#9CA3AF' },
  EXPIRED: { bg: '#FEF2F2', text: '#B91C1C', label: 'Expired', dot: '#EF4444' },
  REJECTED: { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected', dot: '#EF4444' },
  REVOKED: { bg: '#F3F4F6', text: '#6B7280', label: 'Revoked', dot: '#9CA3AF' },
};

const TYPE_LABEL: Record<string, string> = {
  GUEST: 'Guest',
  DELIVERY: 'Delivery',
  SERVICE: 'Service',
  CAB: 'Cab',
  OTHER: 'Other',
};

type ViewMode = 'QUEUE' | 'HISTORY';

export default function GateOperationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('QUEUE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorItem | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [hostActionPending, setHostActionPending] = useState<string | null>(null);

  // Queue fetching (Live operational API)
  const { data: queueData, isLoading: isLoadingQueue, isRefetching: isRefetchingQueue, isError: queueError, refetch: refetchQueue } = useQuery({
    queryKey: ['gate-visitors'],
    queryFn: () => visitorsApi.getGateVisitors(),
    refetchInterval: 30000,
  });

  // History fetching (Manager audit API)
  const { data: historyData, isLoading: isLoadingHistory, isRefetching: isRefetchingHistory, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['gate-history'],
    queryFn: () => visitorsApi.getGateHistory(),
    enabled: viewMode === 'HISTORY',
  });

  const rawQueue = queueData?.visitors || [];
  const rawHistory = historyData?.visitors || [];

  // Mutations
  const checkInMut = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => visitorsApi.checkInVisitor(id, otp),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gate-visitors'] }) },
  });
  const checkOutMut = useMutation({
    mutationFn: (id: string) => visitorsApi.checkOutVisitor(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gate-visitors'] }) },
  });

  const hostedArrivalMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? visitorsApi.approveHostedArrival(id) : visitorsApi.rejectHostedArrival(id),
    onMutate: ({ id }) => setHostActionPending(id),
    onSettled: () => setHostActionPending(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-visitors'] });
      queryClient.invalidateQueries({ queryKey: ['gate-history'] });
    },
    onError: (err: any) => Alert.alert('Could not update arrival', err?.response?.data?.error?.message || 'Please try again.'),
  });

  // Filtering for QUEUE view
  const queueList = useMemo(() => {
    const sq = searchQuery.toLowerCase();
    const searchable = sq ? rawQueue.filter(v => 
      (v.name.toLowerCase().includes(sq)) || 
      (v.provider && v.provider.toLowerCase().includes(sq)) ||
      (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(sq)) ||
      (v.unit?.unitNumber.toLowerCase().includes(sq)) ||
      (v.orderReference && v.orderReference.toLowerCase().includes(sq))
    ) : rawQueue;

    // Sort: CHECKED_IN first (inside), then APPROVED (expected), then PENDING, then others
    const statusOrder: Record<string, number> = { CHECKED_IN: 0, APPROVED: 1, PENDING: 2, CHECKED_OUT: 3, EXPIRED: 4, REJECTED: 5, REVOKED: 6 };
    return searchable.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
  }, [rawQueue, searchQuery]);

  // Filtering for HISTORY view
  const historyList = useMemo(() => {
    const sq = searchQuery.toLowerCase();
    const list = sq ? rawHistory.filter(v => v.name.toLowerCase().includes(sq) || v.unit?.unitNumber.toLowerCase().includes(sq)) : rawHistory;
    // Sort by updatedAt desc (most recent first)
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [rawHistory, searchQuery]);

  // Metrics for queue view
  const metrics = useMemo(() => ({
    inside: queueList.filter(v => v.status === 'CHECKED_IN').length,
    expected: queueList.filter(v => v.status === 'APPROVED').length,
    pending: queueList.filter(v => v.status === 'PENDING').length,
    completed: queueList.filter(v => v.status === 'CHECKED_OUT').length,
  }), [queueList]);

  const activeList = viewMode === 'QUEUE' ? queueList : historyList;
  const isLoading = viewMode === 'QUEUE' ? isLoadingQueue : isLoadingHistory;
  const handleRefresh = viewMode === 'QUEUE' ? refetchQueue : refetchHistory;

  const handleOtpVerify = () => {
    if (selectedVisitor && /^\d{6}$/.test(otpInput)) {
      checkInMut.mutate({ id: selectedVisitor.id, otp: otpInput });
      setShowOtpModal(false);
      setSelectedVisitor(null);
      setOtpInput('');
    }
  };

  const renderQueueCard = useCallback((v: VisitorItem) => {
    return (
      <GateVisitorCard
        key={v.id}
        visitor={v}
        onCheckIn={(id) => {
          const visitor = rawQueue.find(x => x.id === id);
          if (visitor?.requiresOtp) {
            setSelectedVisitor(visitor);
            setOtpInput('');
            setShowOtpModal(true);
          } else {
            checkInMut.mutate({ id });
          }
        }}
        onCheckOut={(id) => {
          if (v.visitorType === 'DELIVERY' && !v.handoffRecipientType) {
            Alert.alert('Handoff required', 'Record delivery handoff first.', [{ text: 'OK' }]);
            return;
          }
          checkOutMut.mutate(id);
        }}
        onHandoff={() => router.push(`/manager/visitors/audit/${v.id}` as any)}
        onRecordArrival={() => {}}
        onApprove={(visitor) => hostedArrivalMut.mutate({ id: visitor.id, action: 'approve' })}
        onReject={(visitor) => hostedArrivalMut.mutate({ id: visitor.id, action: 'reject' })}
        hostActionPending={hostActionPending}
        checkInPending={checkInMut.isPending && checkInMut.variables?.id === v.id ? v.id : null}
        checkOutPending={checkOutMut.isPending && checkOutMut.variables === v.id ? v.id : null}
      />
    );
  }, [rawQueue, checkInMut, checkOutMut, hostedArrivalMut, hostActionPending, router]);

  const renderHistoryCard = useCallback((v: VisitorItem) => {
    const meta = STATUS_META[v.status] || STATUS_META.PENDING;
    const time = new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const unitLabel = v.unit?.unitNumber || v.createdBy?.unitNumber;

    return (
      <View key={v.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.visitorName}>{v.visitorType === 'DELIVERY' || v.visitorType === 'CAB' ? (v.provider || v.name || v.visitorType) : v.name}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{TYPE_LABEL[v.visitorType]}</Text>
              {Boolean(unitLabel) && (
                <>
                  <Text style={styles.cardMetaDot}>•</Text>
                  <Text style={styles.cardMeta}>Unit {unitLabel}</Text>
                </>
              )}
              {Boolean(v.vehicleNumber) && (
                <>
                  <Text style={styles.cardMetaDot}>•</Text>
                  <Text style={styles.cardMeta}>{v.vehicleNumber}</Text>
                </>
              )}
              <Text style={styles.cardMetaDot}>•</Text>
              <Text style={styles.cardMeta}>{time}</Text>
            </View>
          </View>
          
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
            <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <PremiumPressable style={styles.auditBtn} onPress={() => router.push(`/manager/visitors/audit/${v.id}` as any)}>
            <Feather name="file-text" size={14} color={theme.colors.primary} />
            <Text style={styles.auditBtnText}>Inspect Audit Log</Text>
          </PremiumPressable>
        </View>
      </View>
    );
  }, []);

  const { top } = useScreenInsets(false);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader
        variant="subscreen"
        title="Gate Operations"
        onBackPress={() => smartBack(router, '/manager')}
        rightAction={(
          <PremiumPressable style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
            <Feather name="plus" size={15} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </PremiumPressable>
        )}
      />

      {/* View Mode Tabs - Only QUEUE and HISTORY */}
      <View style={styles.viewModeTabs}>
        <PremiumPressable style={[styles.viewTab, viewMode === 'QUEUE' && styles.viewTabActive]} onPress={() => setViewMode('QUEUE')}>
          <Text style={[styles.viewTabText, viewMode === 'QUEUE' && styles.viewTabTextActive]}>Live Queue</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.viewTab, viewMode === 'HISTORY' && styles.viewTabActive]} onPress={() => setViewMode('HISTORY')}>
          <Text style={[styles.viewTabText, viewMode === 'HISTORY' && styles.viewTabTextActive]}>History</Text>
        </PremiumPressable>
      </View>

      {/* Queue Metrics */}
      {viewMode === 'QUEUE' && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.inside}</Text>
            <Text style={styles.metricLbl}>Inside</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.expected}</Text>
            <Text style={styles.metricLbl}>Expected</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.pending}</Text>
            <Text style={styles.metricLbl}>Pending</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.completed}</Text>
            <Text style={styles.metricLbl}>Completed</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <RNTextInput
          style={styles.searchInput}
          placeholder="Search name, provider, unit, vehicle..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={viewMode === 'QUEUE' ? isRefetchingQueue : isRefetchingHistory} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}>
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
          </View>
        ) : (viewMode === 'QUEUE' ? queueError : historyError) ? (
          <View style={styles.errorCard}>
            <Feather name="wifi-off" size={24} color="#B45309" />
            <Text style={styles.errorTitle}>Gate data could not be loaded</Text>
            <Text style={styles.errorDescription}>Check your connection and try again.</Text>
            <PremiumPressable style={styles.retryBtn} onPress={() => { void handleRefresh(); }}>
              <Text style={styles.retryText}>Try again</Text>
            </PremiumPressable>
          </View>
        ) : activeList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name={viewMode === 'QUEUE' ? 'shield' : 'archive'} size={26} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>{viewMode === 'QUEUE' ? 'Gate is clear' : 'No gate history yet'}</Text>
            <Text style={styles.emptyDescription}>{viewMode === 'QUEUE' ? 'New arrivals and approved visitors will appear here.' : 'Completed gate activity will appear here.'}</Text>
          </View>
        ) : (
          activeList.map(viewMode === 'QUEUE' ? renderQueueCard : renderHistoryCard)
        )}
      </ScrollView>

      {/* OTP Modal */}
      {showOtpModal && selectedVisitor && (
        <View style={styles.otpModalOverlay} onStartShouldSetResponder={() => true}>
          <View style={styles.otpModalContent}>
            <View style={styles.otpModalHandle} />
            <Text style={styles.otpModalTitle}>Verify OTP</Text>
            <Text style={styles.otpModalSubtitle}>
              Enter the 6-digit code shared by <Text style={{ fontWeight: '600' }}>{selectedVisitor.name}</Text>
            </Text>
            <View style={styles.otpInputContainer}>
              <RNTextInput
                style={styles.otpInput}
                placeholder="Enter OTP"
                value={otpInput}
                onChangeText={(v: string) => setOtpInput(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                autoFocus
              />
            </View>
            <View style={styles.otpModalActions}>
              <Button label="Cancel" variant="outline" size="md" onPress={() => { setShowOtpModal(false); setSelectedVisitor(null); setOtpInput(''); }} style={{ flex: 1 }} />
              <Button
                label={checkInMut.isPending ? 'Verifying...' : 'Verify & Check In'}
                variant="primary"
                size="md"
                onPress={handleOtpVerify}
                disabled={checkInMut.isPending || !/^\d{6}$/.test(otpInput)}
                loading={checkInMut.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      )}

      <AddVisitorModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite a visitor"
        managerMode
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['gate-visitors'] });
          queryClient.invalidateQueries({ queryKey: ['gate-history'] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inviteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  inviteButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFFFFF' },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: cardSystem.pagePadding, paddingTop: 16, paddingBottom: 4 },
  metricItem: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', marginHorizontal: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  metricVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 2 },
  metricLbl: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  viewModeTabs: { flexDirection: 'row', paddingHorizontal: cardSystem.pagePadding, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  viewTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  viewTabActive: { borderBottomColor: theme.colors.primary },
  viewTabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  viewTabTextActive: { color: theme.colors.primary },

  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary },

  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingBottom: 100, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, paddingRight: 12 },
  visitorName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary },
  cardMetaDot: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#D1D5DB', marginHorizontal: 6 },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  auditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  auditBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.primary },

  // OTP Modal
  otpModalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  otpModalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  otpModalHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 16 },
  otpModalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 2 },
  otpModalSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 },
  otpInputContainer: { marginBottom: 16 },
  otpInput: { height: 56, borderWidth: 2, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 20, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: theme.colors.textPrimary, letterSpacing: 8, textAlign: 'center' },
  otpModalActions: { flexDirection: 'row', gap: 10 },
  errorCard: { alignItems: 'center', backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 16, padding: 24 },
  errorTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#92400E', marginTop: 10 },
  errorDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#B45309', marginTop: 4, textAlign: 'center' },
  retryBtn: { backgroundColor: '#B45309', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFFFFF' },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, marginTop: 8 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginTop: 10 },
  emptyDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
