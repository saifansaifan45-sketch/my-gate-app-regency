import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Pressable, AppState, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../src/theme';
import { visitorsApi, VisitorItem, GateVisitorsResponse } from '../../../src/api/visitors';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { useToast } from '../../../src/store/toast';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { Animated } from 'react-native';

import {
  GateVisitorCard,
  GateSummaryBar,
  GateUnitFilter,
  HandoffSheet,
  OTPInputModal,
  RecordArrivalModal,
} from '../../../src/components/gate';

export default function SecurityGateOperations() {
  const { top, bottomClearance } = useScreenInsets(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [unitFilter, setUnitFilter] = useState('');
  const [debouncedUnitFilter, setDebouncedUnitFilter] = useState('');
  const [appState, setAppState] = useState(AppState.currentState);

  // Modals
  const [isRecordArrivalVisible, setIsRecordArrivalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpModalVisitor, setOtpModalVisitor] = useState<VisitorItem | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [handoffModalVisible, setHandoffModalVisible] = useState(false);
  const [handoffModalVisitor, setHandoffModalVisitor] = useState<VisitorItem | null>(null);

  // Pending states
  const [checkInPending, setCheckInPending] = useState<string | null>(null);
  const [checkOutPending, setCheckOutPending] = useState<string | null>(null);

  // Debounce unit filter
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUnitFilter(unitFilter), 400);
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
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => visitorsApi.checkInVisitor(id, otp),
    onMutate: ({ id }) => setCheckInPending(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setCheckInPending(null);
      setOtpInput('');
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

  // Merge all visitors into single chronological queue (newest first)
  const allVisitors = useCallback(() => {
    if (!gateData) return [];
    const all = [
      ...(gateData.pending || []),
      ...(gateData.approved || []),
      ...(gateData.checkedIn || []),
    ];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [gateData]);

  const handleVerifyOtp = (visitor: VisitorItem) => {
    if (!/^\d{6}$/.test(otpInput)) {
      Alert.alert('Invalid OTP', 'Enter the six-digit OTP shared by the visitor.');
      return;
    }
    checkInMutation.mutate({ id: visitor.id, otp: otpInput });
  };

  const handleDirectCheckIn = (visitor: VisitorItem) => {
    Alert.alert(
      'Confirm entry?',
      `${visitor.provider || visitor.name} is approved. This records their entry and notifies the resident.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm entry', onPress: () => checkInMutation.mutate({ id: visitor.id }) },
      ]
    );
  };

  const handleCheckIn = (visitor: VisitorItem) => {
    if (visitor.requiresOtp) {
      setOtpModalVisitor(visitor);
      setOtpInput('');
      setOtpModalVisible(true);
    } else {
      handleDirectCheckIn(visitor);
    }
  };

  const handleCheckOut = (visitor: VisitorItem) => {
    if (visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType) {
      setHandoffModalVisitor(visitor);
      setHandoffModalVisible(true);
      return;
    }
    Alert.alert(
      'Check out visitor?',
      `${visitor.provider || visitor.name} will be checked out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check out', style: 'destructive', onPress: () => checkOutMutation.mutate(visitor.id) },
      ]
    );
  };

  const handleHandoff = (type: 'RESIDENT' | 'GATE' | 'LOCKER') => {
    if (!handoffModalVisitor) return;
    handoffMutation.mutate({
      id: handoffModalVisitor.id,
      recipientType: type,
      recipientName: undefined, // name input removed for simplicity
    });
  };

  const closeHandoffModal = () => {
    setHandoffModalVisible(false);
    setHandoffModalVisitor(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenEntrance animation="fade">
        <View style={[styles.header, { paddingTop: top + 16 }]}>
          <View style={styles.headerTopRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => smartBack(router, '/work')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="chevron-left" size={22} color="#111827" />
            </Pressable>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Gate operations</Text>
              <Text style={styles.headerSubtitle}>
                {gateData?.summary ? `${gateData.summary.totalToday} visitors logged today` : 'Live arrival queue'}
              </Text>
            </View>
            <PremiumPressable
              style={styles.historyBtn}
              onPress={() => router.push('/work/gate-activity')}
              accessibilityRole="button"
              accessibilityLabel="Open gate history"
            >
              <Feather name="list" size={16} color={theme.colors.primary} />
            </PremiumPressable>
          </View>
          <PremiumPressable
            style={styles.arrivalCta}
            onPress={() => setIsRecordArrivalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Record a new arrival"
          >
            <View style={styles.arrivalCtaIcon}>
              <Feather name="plus-circle" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.arrivalCtaCopy}>
              <Text style={styles.arrivalCtaTitle}>Record a new arrival</Text>
              <Text style={styles.arrivalCtaSubtitle}>Select a unit to alert the resident</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#D7EBDD" />
          </PremiumPressable>
        </View>
      </ScreenEntrance>

      {/* Live queue summary */}
      <GateSummaryBar summary={gateData?.summary} />

      {/* Unit filter */}
      <ScreenEntrance delay={40} distance={8}>
        <GateUnitFilter
          value={unitFilter}
          onChangeText={setUnitFilter}
          onClear={() => setUnitFilter('')}
        />
      </ScreenEntrance>

      {/* Visitor list - Single Chronological Queue */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : allVisitors().length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Feather name="shield" size={32} color={theme.colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No visitors today</Text>
            <Text style={styles.emptyDesc}>
              {unitFilter
                ? `No visitors matching Unit ${unitFilter.toUpperCase()}.`
                : 'All clear at the gate. New arrivals will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {allVisitors().map((visitor, i) => (
              <GateVisitorCard
                key={visitor.id}
                visitor={visitor}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onHandoff={(v) => { setHandoffModalVisitor(v); setHandoffModalVisible(true); }}
                onRecordArrival={() => {}}
                checkInPending={checkInPending}
                checkOutPending={checkOutPending}
              />
            ))}
          </View>
        )}
      </ScrollView>

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
        onClose={() => { setOtpModalVisible(false); setOtpModalVisitor(null); setOtpInput(''); }}
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

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 18, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerLeft: { flex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary },
  headerSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  historyBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4EC', borderWidth: 1, borderColor: '#CFE3D3', borderRadius: 14 },
  arrivalCta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, backgroundColor: theme.colors.primary },
  arrivalCtaIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  arrivalCtaCopy: { flex: 1, gap: 2 },
  arrivalCtaTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: '#FFFFFF' },
  arrivalCtaSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: '#D7EBDD' },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textPrimary },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 18 },
});