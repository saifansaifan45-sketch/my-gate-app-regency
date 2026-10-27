import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TextInput as RNTextInput, Animated, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitorsApi, VisitorStatus, VisitorItem } from '../../../src/api/visitors';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { Button } from '../../../src/components/ui/Button';
import { theme } from '../../../src/theme';
import { smartBack } from '../../../src/navigation/history';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { GateVisitorCard } from '../../../src/components/gate/GateVisitorCard';
import { AddVisitorModal } from '../../../src/components/add-visitor-modal';

const TAB_PADDING = 20;
const TAB_GAP = 8;

const STATUS_META: Record<VisitorStatus, { bg: string; text: string; label: string; dot: string }> = {
  PENDING: { bg: '#FFF7ED', text: '#C2410C', label: 'Pending Auth', dot: '#F97316' },
  APPROVED: { bg: '#ECFDF5', text: '#047857', label: 'Expected', dot: '#10B981' },
  CHECKED_IN: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Inside', dot: '#3B82F6' },
  CHECKED_OUT: { bg: '#F3F4F6', text: '#6B7280', label: 'Completed', dot: '#9CA3AF' },
  EXPIRED: { bg: '#FEF2F2', text: '#B91C1C', label: 'Expired', dot: '#EF4444' },
  REJECTED: { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected', dot: '#EF4444' },
  REVOKED: { bg: '#F3F4F6', text: '#6B7280', label: 'Revoked', dot: '#9CA3AF' },
};

const TYPE_META: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bg: string; label: string }> = {
  GUEST: { icon: 'user', color: '#143D2A', bg: '#E8F5E9', label: 'Guest' },
  CAB: { icon: 'truck', color: '#2563EB', bg: '#EAF1FF', label: 'Cab' },
  DELIVERY: { icon: 'package', color: '#A16207', bg: '#FFF3D6', label: 'Delivery' },
  SERVICE: { icon: 'briefcase', color: '#7C3AED', bg: '#F3E8FF', label: 'Service' },
  OTHER: { icon: 'user', color: '#6B7280', bg: '#F3F4F6', label: 'Other' },
  PERMANENT: { icon: 'key', color: '#7C2D12', bg: '#FFF7ED', label: 'Family Pass' },
};

const TYPE_LABEL: Record<string, string> = {
  GUEST: 'Guest',
  DELIVERY: 'Delivery',
  SERVICE: 'Service',
  CAB: 'Cab',
  OTHER: 'Other',
  PERMANENT: 'Family Pass',
};

type ViewMode = 'QUEUE' | 'HISTORY';

export default function GateOperationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const TAB_WIDTH = (screenWidth - TAB_PADDING * 2 - TAB_GAP) / 2;

  const [viewMode, setViewMode] = useState<ViewMode>('QUEUE');
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorItem | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [hostActionPending, setHostActionPending] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  // Queue fetching (Live operational API)
  const { data: queueData, isLoading: isLoadingQueue, isRefetching: isRefetchingQueue, isError: queueError, refetch: refetchQueue } = useQuery({
    queryKey: ['gate-visitors'],
    queryFn: () => visitorsApi.getGateVisitors(),
    refetchInterval: 30000,
  });

  // History fetching (Manager audit API) – always enabled so data is ready on tab switch
  const { data: historyData, isFetching: isFetchingHistory, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['gate-history'],
    queryFn: () => visitorsApi.getGateHistory(),
    staleTime: 30_000,
  });

  const rawQueue = queueData?.visitors || [];
  const rawHistory = historyData?.visitors || [];

  // Mutations
  const checkInMut = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => {
      if (id.startsWith('pp-')) {
        return visitorsApi.checkInPermanentPass(id.replace('pp-', ''));
      }
      return visitorsApi.checkInVisitor(id, otp);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gate-visitors'] }); },
  });
  const checkOutMut = useMutation({
    mutationFn: (id: string) => visitorsApi.checkOutVisitor(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gate-visitors'] }); },
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

  const switchTab = (tab: ViewMode) => {
    if (tab === viewMode) return;
    const toValue = tab === 'HISTORY' ? 1 : 0;
    
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: false,
      friction: 12,
      tension: 100,
    }).start();

    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setViewMode(tab);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_PADDING, TAB_PADDING + TAB_WIDTH + TAB_GAP],
  });

  // Filtering for QUEUE view
  const queueList = useMemo(() => {
    let list = rawQueue;
    if (queueStatusFilter !== 'ALL') {
      list = list.filter(v => v.status === queueStatusFilter);
    }
    const sq = searchQuery.toLowerCase().trim();
    if (sq) {
      list = list.filter(v => 
        (v.name.toLowerCase().includes(sq)) || 
        (v.provider && v.provider.toLowerCase().includes(sq)) ||
        (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(sq)) ||
        (v.unit?.unitNumber.toLowerCase().includes(sq)) ||
        (v.orderReference && v.orderReference.toLowerCase().includes(sq))
      );
    }

    const statusOrder: Record<string, number> = { CHECKED_IN: 0, APPROVED: 1, PENDING: 2, CHECKED_OUT: 3, EXPIRED: 4, REJECTED: 5, REVOKED: 6 };
    return list.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
  }, [rawQueue, queueStatusFilter, searchQuery]);

  // Filtering for HISTORY view
  const historyList = useMemo(() => {
    let list = rawHistory;
    if (historyStatusFilter !== 'ALL') {
      list = list.filter(v => v.status === historyStatusFilter);
    }
    const sq = searchQuery.toLowerCase().trim();
    if (sq) {
      list = list.filter(v => 
        v.name.toLowerCase().includes(sq) || 
        v.unit?.unitNumber.toLowerCase().includes(sq) ||
        (v.provider && v.provider.toLowerCase().includes(sq)) ||
        (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(sq))
      );
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [rawHistory, historyStatusFilter, searchQuery]);

  // Metrics for queue view
  const metrics = useMemo(() => ({
    all: rawQueue.length,
    inside: rawQueue.filter(v => v.status === 'CHECKED_IN').length,
    expected: rawQueue.filter(v => v.status === 'APPROVED').length,
    pending: rawQueue.filter(v => v.status === 'PENDING').length,
  }), [rawQueue]);

  const activeList = viewMode === 'QUEUE' ? queueList : historyList;
  const isLoading = viewMode === 'QUEUE' ? (isLoadingQueue && !queueData) : (isFetchingHistory && !historyData);
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
          const visitor = rawQueue.find(x => x.id === id) || v;
          if (visitor?.requiresOtp) {
            setSelectedVisitor(visitor);
            setOtpInput('');
            setShowOtpModal(true);
          } else {
            checkInMut.mutate({ id: visitor.id });
          }
        }}
        onCheckOut={() => {
          if (v.visitorType === 'DELIVERY' && !v.handoffRecipientType) {
            router.push(`/manager/visitors/audit/${v.id}` as any);
            return;
          }
          checkOutMut.mutate(v.id);
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
    const date = new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const unitLabel = v.unit?.unitNumber || v.createdBy?.unitNumber;
    const type = TYPE_META[v.visitorType] || TYPE_META.OTHER;
    const name = v.visitorType === 'DELIVERY' || v.visitorType === 'CAB' ? (v.provider || v.name || v.visitorType) : v.name;

    return (
      <View key={v.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: type.bg }]}>
            <Feather name={type.icon} size={18} color={type.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.visitorName} numberOfLines={1}>{name}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{TYPE_LABEL[v.visitorType] || v.visitorType}</Text>
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
              <Text style={styles.cardMeta}>{date} · {time}</Text>
            </View>
          </View>
          
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
            <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.historyFooter}>
          <PremiumPressable
            style={styles.auditBtn}
            onPress={() => router.push(`/manager/visitors/audit/${v.id}` as any)}
          >
            <View style={styles.auditBtnLeft}>
              <Feather name="file-text" size={14} color={theme.colors.primary} />
              <Text style={styles.auditBtnText}>Inspect Audit Log</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.primary} />
          </PremiumPressable>
        </View>
      </View>
    );
  }, [router]);

  const { bottomClearance } = useScreenInsets(false);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Gate Operations"
        onBackPress={() => smartBack(router, '/manager/index')}
        rightAction={(
          <PremiumPressable style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </PremiumPressable>
        )}
      />

      {/* Tabs with Underline Indicator matching Community.tsx pattern */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabs}>
          <PremiumPressable
            style={[styles.tab, { width: TAB_WIDTH }]}
            onPress={() => switchTab('QUEUE')}
          >
            <Text style={[styles.tabText, viewMode === 'QUEUE' && styles.tabTextActive]}>
              Live Queue{rawQueue.length > 0 ? ` (${rawQueue.length})` : ''}
            </Text>
          </PremiumPressable>
          <PremiumPressable
            style={[styles.tab, { width: TAB_WIDTH }]}
            onPress={() => switchTab('HISTORY')}
          >
            <Text style={[styles.tabText, viewMode === 'HISTORY' && styles.tabTextActive]}>
              History
            </Text>
          </PremiumPressable>
        </View>
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: TAB_WIDTH, transform: [{ translateX: indicatorTranslateX }] },
          ]}
        />
      </View>

      <Animated.View style={[styles.contentOuter, { opacity: contentOpacity }]}>
        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={theme.colors.textSecondary} style={styles.searchIcon} />
            <RNTextInput
              style={styles.searchInput}
              placeholder="Search name, provider, unit, vehicle..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.textSecondary}
            />
            {searchQuery.length > 0 && (
              <PremiumPressable onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={theme.colors.textSecondary} />
              </PremiumPressable>
            )}
          </View>
        </View>

        {/* Filter Chips matching Community Category filters */}
        <View style={styles.filterOuter}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {viewMode === 'QUEUE' ? (
              [
                { id: 'ALL', label: `All (${metrics.all})` },
                { id: 'CHECKED_IN', label: `Inside (${metrics.inside})` },
                { id: 'APPROVED', label: `Expected (${metrics.expected})` },
                { id: 'PENDING', label: `Pending (${metrics.pending})` },
              ].map((chip) => (
                <PremiumPressable
                  key={chip.id}
                  style={[styles.filterChip, queueStatusFilter === chip.id && styles.filterChipActive]}
                  onPress={() => setQueueStatusFilter(chip.id)}
                >
                  <Text style={[styles.filterText, queueStatusFilter === chip.id && styles.filterTextActive]}>
                    {chip.label}
                  </Text>
                </PremiumPressable>
              ))
            ) : (
              [
                { id: 'ALL', label: 'All Activity' },
                { id: 'CHECKED_OUT', label: 'Completed' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'EXPIRED', label: 'Expired' },
              ].map((chip) => (
                <PremiumPressable
                  key={chip.id}
                  style={[styles.filterChip, historyStatusFilter === chip.id && styles.filterChipActive]}
                  onPress={() => setHistoryStatusFilter(chip.id)}
                >
                  <Text style={[styles.filterText, historyStatusFilter === chip.id && styles.filterTextActive]}>
                    {chip.label}
                  </Text>
                </PremiumPressable>
              ))
            )}
          </ScrollView>
        </View>

        {/* List Content */}
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 36 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={viewMode === 'QUEUE' ? isRefetchingQueue : isFetchingHistory && !!historyData} onRefresh={() => { void handleRefresh(); }} tintColor={theme.colors.primary} />}
        >
          {isLoading ? (
            <View style={{ gap: 14 }}>
              <Skeleton height={130} borderRadius={20} />
              <Skeleton height={130} borderRadius={20} />
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
            <EmptyState
              icon={viewMode === 'QUEUE' ? 'shield' : 'archive'}
              title={viewMode === 'QUEUE' ? (queueStatusFilter === 'ALL' ? 'Gate is clear' : 'No visitors in this status') : (historyStatusFilter === 'ALL' ? 'No gate history yet' : 'No logs in this category')}
              description={viewMode === 'QUEUE' ? 'New arrivals and approved visitors will appear here in real time.' : 'Completed gate activity records will appear here.'}
            />
          ) : (
            activeList.map(viewMode === 'QUEUE' ? renderQueueCard : renderHistoryCard)
          )}
        </ScrollView>
      </Animated.View>

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
  contentOuter: { flex: 1 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteButtonText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#FFFFFF' },

  // Tabs matching Community.tsx
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: TAB_PADDING,
    gap: TAB_GAP,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },

  // Filter Chips matching Community page
  filterOuter: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 98,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  list: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 100, gap: 14 },
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
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0, gap: 4 },
  visitorName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, letterSpacing: -0.3, color: theme.colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  cardMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary },
  cardMetaDot: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#D1D5DB' },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 98, gap: 5, flexShrink: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 0.3, textTransform: 'uppercase' },

  historyFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(20, 61, 42, 0.05)',
    paddingTop: 10,
  },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  auditBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
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
  retryBtn: { backgroundColor: '#B45309', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFFFFF' },
});
