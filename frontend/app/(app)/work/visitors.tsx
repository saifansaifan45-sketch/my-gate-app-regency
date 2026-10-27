import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable, AppState, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../src/theme';
import { visitorsApi, VisitorItem, GateVisitorsResponse } from '../../../src/api/visitors';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Text } from '../../../src/components/ui/Text';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { useToast } from '../../../src/store/toast';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';

import {
  GateVisitorCard,
  GateSummaryBar,
  GateUnitFilter,
  HandoffSheet,
  OTPInputModal,
  RecordArrivalModal,
} from '../../../src/components/gate';

type QueueFilter = 'ALL' | 'INSIDE' | 'EXPECTED' | 'PENDING';

export default function SecurityGateOperations() {
  const { top, bottomClearance } = useScreenInsets(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [unitFilter, setUnitFilter] = useState('');
  const [debouncedUnitFilter, setDebouncedUnitFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [appState, setAppState] = useState(AppState.currentState);

  // Modals
  const [isRecordArrivalVisible, setIsRecordArrivalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpModalVisitor, setOtpModalVisitor] = useState<VisitorItem | null>(null);
  const [handoffModalVisible, setHandoffModalVisible] = useState(false);
  const [handoffModalVisitor, setHandoffModalVisitor] = useState<VisitorItem | null>(null);

  // Pending states
  const [checkInPending, setCheckInPending] = useState<string | null>(null);
  const [checkOutPending, setCheckOutPending] = useState<string | null>(null);

  // Debounce unit filter for backend queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUnitFilter(unitFilter.trim()), 350);
    return () => clearTimeout(timer);
  }, [unitFilter]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const { data: gateData, isLoading, isRefetching, refetch } = useQuery<GateVisitorsResponse>({
    queryKey: ['security-gate', debouncedUnitFilter],
    queryFn: () => visitorsApi.getGateVisitors({ unitLabel: debouncedUnitFilter }),
    refetchInterval: appState === 'active' ? 15000 : false,
    placeholderData: (previous) => previous,
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => {
      if (id.startsWith('pp-')) {
        return visitorsApi.checkInPermanentPass(id.replace('pp-', ''));
      }
      return visitorsApi.checkInVisitor(id, otp);
    },
    onMutate: ({ id }) => setCheckInPending(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setCheckInPending(null);
      setOtpModalVisible(false);
      setOtpModalVisitor(null);
      showToast({ title: 'Visitor checked in', message: 'The visitor is now marked as at the gate.', type: 'success' });
    },
    onError: (err: any) => {
      setCheckInPending(null);
      showToast({
        title: 'Check-in failed',
        message: err?.response?.data?.error?.message || 'Could not check in visitor.',
        type: 'error',
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => visitorsApi.checkOutVisitor(id),
    onMutate: (id) => setCheckOutPending(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setCheckOutPending(null);
      showToast({ title: 'Visitor checked out', message: 'Gate activity has been updated.', type: 'success' });
    },
    onError: (err: any) => {
      setCheckOutPending(null);
      showToast({ title: 'Check-out failed', message: err?.response?.data?.error?.message || 'Could not check out visitor.', type: 'error' });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: ({ id, recipientType, recipientName }: { id: string; recipientType: string; recipientName?: string }) =>
      visitorsApi.handoffDelivery(id, { recipientType, recipientName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setHandoffModalVisible(false);
      setHandoffModalVisitor(null);
      showToast({ title: 'Handoff recorded', message: 'The delivery handoff is now in gate history.', type: 'success' });
    },
    onError: (err: any) => {
      showToast({ title: 'Handoff failed', message: err?.response?.data?.error?.message || 'Could not record handoff.', type: 'error' });
    },
  });

  // Filter and sort visitors
  const filteredVisitors = useMemo(() => {
    if (!gateData) return [];

    let pool: VisitorItem[] = [];
    if (queueFilter === 'ALL') {
      pool = [...(gateData.pending || []), ...(gateData.approved || []), ...(gateData.checkedIn || [])];
    } else if (queueFilter === 'INSIDE') {
      pool = [...(gateData.checkedIn || [])];
    } else if (queueFilter === 'EXPECTED') {
      pool = [...(gateData.approved || [])];
    } else if (queueFilter === 'PENDING') {
      pool = [...(gateData.pending || [])];
    }

    const term = unitFilter.trim().toLowerCase();
    if (term) {
      pool = pool.filter((v) => {
        const name = (v.name || '').toLowerCase();
        const provider = (v.provider || '').toLowerCase();
        const unit = (v.unit?.unitNumber || v.createdBy?.unitNumber || '').toLowerCase();
        const plate = (v.vehicleNumber || '').toLowerCase();
        const order = (v.orderReference || '').toLowerCase();
        return name.includes(term) || provider.includes(term) || unit.includes(term) || plate.includes(term) || order.includes(term);
      });
    }

    return pool.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [gateData, queueFilter, unitFilter]);

  const handleVerifyOtp = (otp: string) => {
    const visitor = otpModalVisitor;
    if (!visitor) return;
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid OTP', 'Enter the six-digit OTP shared by the visitor.');
      return;
    }
    checkInMutation.mutate({ id: visitor.id, otp });
  };

  const handleCheckIn = (visitor: VisitorItem) => {
    if (visitor.requiresOtp) {
      setOtpModalVisitor(visitor);
      setOtpModalVisible(true);
    } else {
      checkInMutation.mutate({ id: visitor.id });
    }
  };

  const handleCheckOut = (visitor: VisitorItem) => {
    if (visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType) {
      setHandoffModalVisitor(visitor);
      setHandoffModalVisible(true);
      return;
    }
    checkOutMutation.mutate(visitor.id);
  };

  const handleHandoff = (type: 'RESIDENT' | 'GATE' | 'LOCKER') => {
    if (!handoffModalVisitor) return;
    handoffMutation.mutate({
      id: handoffModalVisitor.id,
      recipientType: type,
      recipientName: undefined,
    });
  };

  const closeHandoffModal = () => {
    setHandoffModalVisible(false);
    setHandoffModalVisitor(null);
  };

  const filterChips: Array<{ key: QueueFilter; label: string; count?: number }> = [
    { key: 'ALL', label: 'All', count: (gateData?.pending?.length || 0) + (gateData?.approved?.length || 0) + (gateData?.checkedIn?.length || 0) },
    { key: 'INSIDE', label: 'Inside', count: gateData?.checkedIn?.length || 0 },
    { key: 'EXPECTED', label: 'Expected', count: gateData?.approved?.length || 0 },
    { key: 'PENDING', label: 'Pending', count: gateData?.pending?.length || 0 },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenEntrance animation="fade">
        <View style={[styles.header, { paddingTop: Math.max(top + 10, 20) }]}>
          <View style={styles.responsiveInner}>
            <View style={styles.headerTopRow}>
              <Pressable
                style={styles.backBtn}
                onPress={() => smartBack(router, '/work/index')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Feather name="arrow-left" size={20} color="#111827" />
              </Pressable>

              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Gate Operations</Text>
                <Text style={styles.headerSubtitle}>
                  {gateData?.summary ? `${gateData.summary.totalToday} logged today` : 'Live arrival queue'}
                </Text>
              </View>

              <PremiumPressable
                style={styles.historyBtn}
                onPress={() => router.push('/work/gate-activity')}
                accessibilityRole="button"
                accessibilityLabel="Open gate history"
                scaleTo={0.92}
              >
                <Feather name="clock" size={17} color={theme.colors.primary} />
              </PremiumPressable>
            </View>

            {/* Record New Arrival Action CTA */}
            <PremiumPressable
              style={styles.arrivalCta}
              onPress={() => setIsRecordArrivalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Record a new arrival"
              scaleTo={0.97}
            >
              <View style={styles.arrivalCtaIcon}>
                <Feather name="plus" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.arrivalCtaCopy}>
                <Text style={styles.arrivalCtaTitle}>Record New Arrival</Text>
                <Text style={styles.arrivalCtaSubtitle}>Quick pass for guest, cab or delivery</Text>
              </View>
              <Feather name="chevron-right" size={18} color="rgba(255, 255, 255, 0.7)" />
            </PremiumPressable>
          </View>
        </View>
      </ScreenEntrance>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        <View style={styles.responsiveInner}>
          {/* Live Queue Summary Bar */}
          <GateSummaryBar summary={gateData?.summary} />

          {/* Unit / Search Filter */}
          <ScreenEntrance delay={40} distance={8}>
            <GateUnitFilter
              value={unitFilter}
              onChangeText={setUnitFilter}
              onClear={() => setUnitFilter('')}
            />
          </ScreenEntrance>

          {/* Horizontal Status Chips */}
          <View style={styles.filterChipRow}>
            {filterChips.map((chip) => {
              const isActive = queueFilter === chip.key;
              return (
                <PremiumPressable
                  key={chip.key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setQueueFilter(chip.key)}
                  scaleTo={0.95}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {chip.label}
                  </Text>
                  {typeof chip.count === 'number' && chip.count > 0 && (
                    <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                      <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                        {chip.count}
                      </Text>
                    </View>
                  )}
                </PremiumPressable>
              );
            })}
          </View>
        </View>

        {/* Visitor List - Single Chronological Queue */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={theme.colors.primary} />}
        >
          <View style={styles.responsiveInner}>
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : filteredVisitors.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="shield" size={30} color={theme.colors.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {unitFilter ? 'No matching visitors' : 'Queue is all clear'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {unitFilter
                    ? `No visitor records matching "${unitFilter}". Try searching by unit, name, or vehicle plate.`
                    : 'No active arrivals in this filter. New visitor entries will appear here in real-time.'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardsWrap}>
                {filteredVisitors.map((visitor) => (
                  <GateVisitorCard
                    key={visitor.id}
                    visitor={visitor}
                    onCheckIn={(id) => {
                      const item = filteredVisitors.find((v) => v.id === id) || visitor;
                      handleCheckIn(item);
                    }}
                    onCheckOut={(id) => {
                      const item = filteredVisitors.find((v) => v.id === id) || visitor;
                      handleCheckOut(item);
                    }}
                    onHandoff={(v) => { setHandoffModalVisitor(v); setHandoffModalVisible(true); }}
                    onRecordArrival={() => {}}
                    checkInPending={checkInPending}
                    checkOutPending={checkOutPending}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Record Arrival Modal */}
      <RecordArrivalModal
        visible={isRecordArrivalVisible}
        onClose={() => setIsRecordArrivalVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['security-gate'] });
          setIsRecordArrivalVisible(false);
        }}
      />

      {/* OTP Verification Modal */}
      <OTPInputModal
        visible={otpModalVisible}
        onClose={() => { setOtpModalVisible(false); setOtpModalVisitor(null); }}
        onVerify={handleVerifyOtp}
        visitorName={otpModalVisitor?.name || ''}
        isPending={checkInMutation.isPending}
      />

      {/* Handoff Modal */}
      <HandoffSheet
        visible={handoffModalVisible}
        onClose={closeHandoffModal}
        visitor={handoffModalVisitor}
        onHandoff={handleHandoff}
        isPending={handoffMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  mainContent: { flex: 1 },
  responsiveInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 61, 42, 0.06)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  historyBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4EC',
    borderWidth: 1,
    borderColor: '#CFE3D3',
    borderRadius: 12,
  },
  arrivalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  arrivalCtaIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  arrivalCtaCopy: {
    flex: 1,
    gap: 1,
  },
  arrivalCtaTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  arrivalCtaSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#D7EBDD',
  },

  // Filter Chips
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 98,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  filterBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  cardsWrap: { gap: 12 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
});
