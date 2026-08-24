import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Pressable, Animated, Dimensions } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../src/theme';
import { visitorsApi, VisitorItem, GateVisitorsResponse } from '../../../src/api/visitors';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { UnannouncedArrivalModal } from '../../../src/components/unannounced-arrival-modal';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { useToast } from '../../../src/store/toast';

type Tab = 'pending' | 'approved' | 'checkedIn';

const TABS: { id: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'pending', label: 'Pending', icon: 'clock' },
  { id: 'approved', label: 'Approved', icon: 'check-circle' },
  { id: 'checkedIn', label: 'At Gate', icon: 'log-in' },
];

const VISITOR_TYPE_META: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = {
  GUEST: { icon: 'user', color: '#143D2A', bg: '#E8F5E9' },
  CAB: { icon: 'truck', color: '#2563EB', bg: '#EAF1FF' },
  DELIVERY: { icon: 'package', color: '#A16207', bg: '#FFF3D6' },
  SERVICE: { icon: 'briefcase', color: '#7C3AED', bg: '#F3E8FF' },
  OTHER: { icon: 'user', color: '#6B7280', bg: '#F3F4F6' },
};

const TAB_HINTS: Record<Tab, string> = {
  pending: 'Waiting for the resident to approve this arrival.',
  approved: 'Verify expected guests by OTP. Confirm approved cabs, deliveries, and services to record entry.',
  checkedIn: 'Visitors currently inside the community.',
};

const TAB_PADDING = 20;
const TAB_GAP = 6;

function AnimatedCard({ children, index, isVisible }: { children: React.ReactNode; index: number; isVisible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 50, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 50, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(16);
    }
  }, [isVisible, index]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function SecurityGateOperations() {
  const { bottomClearance } = useScreenInsets(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [unitFilter, setUnitFilter] = useState('');
  const [debouncedUnitFilter, setDebouncedUnitFilter] = useState('');
  const [listKey, setListKey] = useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedUnitFilter(unitFilter), 400);
    return () => clearTimeout(timer);
  }, [unitFilter]);

  const [isUnannouncedVisible, setIsUnannouncedVisible] = useState(false);
  const [otpValues, setOtpValues] = useState<Record<string, string>>({});
  const [handoffModalVisitor, setHandoffModalVisitor] = useState<VisitorItem | null>(null);
  const [handoffType, setHandoffType] = useState<'RESIDENT' | 'GATE' | 'LOCKER'>('RESIDENT');
  const [handoffName, setHandoffName] = useState('');

  const { data: gateData, isLoading } = useQuery<GateVisitorsResponse>({
    queryKey: ['security-gate', debouncedUnitFilter],
    queryFn: () => visitorsApi.getGateVisitors({ unitLabel: debouncedUnitFilter }),
    refetchInterval: 5000,
    placeholderData: (previous) => previous,
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => visitorsApi.checkInVisitor(id, otp),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setOtpValues((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      showToast({ title: 'Visitor checked in', message: 'The visitor is now marked as at the gate.', type: 'success' });
    },
    onError: (err: any) => {
      Alert.alert(
        'Check-in failed',
        err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not check in visitor.'
      );
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => visitorsApi.checkOutVisitor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      showToast({ title: 'Visitor checked out', message: 'Gate activity has been updated.', type: 'success' });
    },
    onError: (err: any) => {
      Alert.alert('Check-out failed', err?.response?.data?.error?.message || 'Could not check out visitor.');
    },
  });

  const handoffMutation = useMutation({
    mutationFn: ({ id, recipientType, recipientName }: { id: string; recipientType: string; recipientName?: string }) =>
      visitorsApi.handoffDelivery(id, { recipientType, recipientName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-gate'] });
      setHandoffModalVisitor(null);
      setHandoffName('');
      setHandoffType('RESIDENT');
      showToast({ title: 'Handoff recorded', message: 'The delivery handoff is now in gate history.', type: 'success' });
    },
    onError: (err: any) => {
      Alert.alert('Handoff failed', err?.response?.data?.error?.message || 'Could not record handoff.');
    },
  });

  const pending = gateData?.pending || [];
  const approved = gateData?.approved || [];
  const checkedIn = gateData?.checkedIn || [];

  const handleVerifyOtp = (visitor: VisitorItem) => {
    const otp = otpValues[visitor.id] || '';
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid OTP', 'Enter the six-digit OTP shared by the visitor.');
      return;
    }
    checkInMutation.mutate({ id: visitor.id, otp });
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

  const handleCheckOut = (visitor: VisitorItem) => {
    if (visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType) {
      setHandoffModalVisitor(visitor);
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

  const handleHandoff = () => {
    if (!handoffModalVisitor) return;
    handoffMutation.mutate({
      id: handoffModalVisitor.id,
      recipientType: handoffType,
      recipientName: handoffName || undefined,
    });
  };

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setListKey((k) => k + 1);
  };

  const currentList = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : checkedIn;
  const counts: Record<Tab, number> = { pending: pending.length, approved: approved.length, checkedIn: checkedIn.length };

  const renderVisitorCard = (visitor: VisitorItem, context: Tab, index: number) => {
    const meta = VISITOR_TYPE_META[visitor.visitorType] || VISITOR_TYPE_META.OTHER;
    const typeLabel = visitor.visitorType === 'GUEST' ? 'Guest' : visitor.visitorType === 'CAB' ? 'Cab' : visitor.visitorType === 'DELIVERY' ? 'Delivery' : visitor.visitorType === 'SERVICE' ? 'Service' : 'Other';
    const name = visitor.provider || visitor.name;
    const unitLabel = visitor.unit?.unitNumber || '—';

    return (
      <AnimatedCard key={visitor.id} index={index} isVisible={true}>
        <View style={styles.card}>
          {/* Card header: icon + name + badge */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
              <Feather name={meta.icon} size={18} color={meta.color} />
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
              {visitor.isPreApproved && context !== 'pending' ? (
                <View style={styles.preApprovedBadge}>
                  <Text style={styles.preApprovedText}>Pre-approved</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.cardMeta}>
            <View style={styles.metaChip}>
              <Feather name="home" size={11} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>Unit {unitLabel}</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: meta.bg }]}>
              <Feather name={meta.icon} size={11} color={meta.color} />
              <Text style={[styles.metaText, { color: meta.color }]}>{typeLabel}</Text>
            </View>
            {visitor.vehicleNumber ? (
              <View style={styles.metaChip}>
                <Feather name="credit-card" size={11} color={theme.colors.textSecondary} />
                <Text style={styles.metaText}>{visitor.vehicleNumber}</Text>
              </View>
            ) : null}
          </View>

          {/* Context-specific actions */}
          {context === 'pending' && (
            <View style={styles.cardAction}>
              <View style={styles.pendingBadge}>
                <Feather name="clock" size={12} color="#D97706" />
                <Text style={styles.pendingText}>Waiting for resident</Text>
              </View>
            </View>
          )}

          {context === 'approved' && (
            <View style={styles.cardAction}>
              {visitor.requiresOtp ? (
                <View style={styles.otpRow}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="Enter OTP"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={otpValues[visitor.id] || ''}
                    onChangeText={(value) => setOtpValues((current) => ({
                      ...current,
                      [visitor.id]: value.replace(/\D/g, ''),
                    }))}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                  />
                  <PremiumPressable
                    style={[styles.verifyBtn, checkInMutation.isPending && styles.btnDisabled]}
                    onPress={() => handleVerifyOtp(visitor)}
                    disabled={checkInMutation.isPending}
                  >
                    {checkInMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="check" size={16} color="#FFFFFF" />
                    )}
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </PremiumPressable>
                </View>
              ) : (
                <Button
                  label="Confirm entry"
                  variant="primary"
                  size="sm"
                  icon="check"
                  onPress={() => handleDirectCheckIn(visitor)}
                  disabled={checkInMutation.isPending}
                  style={styles.checkInBtn}
                />
              )}
            </View>
          )}

          {context === 'checkedIn' && (
            <View style={styles.cardAction}>
              <View style={styles.checkedInRow}>
                {visitor.checkInTime ? (
                  <Text style={styles.checkedInTime}>
                    Since {new Date(visitor.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : null}
                <View style={styles.actionBtns}>
                  {visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType ? (
                    <PremiumPressable
                      style={styles.handoffBtn}
                      onPress={() => setHandoffModalVisitor(visitor)}
                    >
                      <Feather name="package" size={14} color="#FFFFFF" />
                      <Text style={styles.handoffBtnText}>Handoff</Text>
                    </PremiumPressable>
                  ) : null}
                  <PremiumPressable
                    style={[styles.checkOutBtn, checkOutMutation.isPending && styles.btnDisabled]}
                    onPress={() => handleCheckOut(visitor)}
                    disabled={checkOutMutation.isPending}
                  >
                    <Feather name="log-out" size={14} color="#DC2626" />
                    <Text style={styles.checkOutBtnText}>Check out</Text>
                  </PremiumPressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </AnimatedCard>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => smartBack(router, '/work')} hitSlop={8}>
          <Feather name="chevron-left" size={22} color="#111827" />
        </Pressable>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Gate Operations</Text>
          <Text style={styles.headerSubtitle}>
            {gateData?.summary ? `${gateData.summary.totalToday} visitors today` : 'Loading...'}
          </Text>
        </View>
        <PremiumPressable
          style={styles.newArrivalBtn}
          onPress={() => setIsUnannouncedVisible(true)}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.newArrivalBtnText}>New arrival</Text>
        </PremiumPressable>
      </View>

      {/* Summary chips */}
      {gateData?.summary ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#FEF3C7' }]}>
            <Feather name="clock" size={12} color="#D97706" />
            <Text style={[styles.summaryText, { color: '#D97706' }]}>{gateData.summary.pending} pending</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#D1FAE5' }]}>
            <Feather name="check-circle" size={12} color="#059669" />
            <Text style={[styles.summaryText, { color: '#059669' }]}>{gateData.summary.approved} approved</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#E0E7FF' }]}>
            <Feather name="log-in" size={12} color="#2563EB" />
            <Text style={[styles.summaryText, { color: '#2563EB' }]}>{gateData.summary.checkedIn} inside</Text>
          </View>
        </View>
      ) : null}

      {/* Unit filter */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by unit (e.g. 7B)"
            placeholderTextColor={theme.colors.textSecondary}
            value={unitFilter}
            onChangeText={setUnitFilter}
            autoCapitalize="characters"
          />
          {unitFilter ? (
            <PremiumPressable onPress={() => setUnitFilter('')} hitSlop={8}>
              <Feather name="x" size={14} color={theme.colors.textSecondary} />
            </PremiumPressable>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <PremiumPressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => switchTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {counts[tab.id] > 0 ? (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}>
                  {counts[tab.id]}
                </Text>
              </View>
            ) : null}
          </PremiumPressable>
        ))}
      </View>

      {/* Flow hint */}
      <View style={styles.flowHint}>
        <Feather name={TABS.find((t) => t.id === activeTab)!.icon} size={14} color={theme.colors.primary} />
        <Text style={styles.flowHintText}>{TAB_HINTS[activeTab]}</Text>
      </View>

      {/* Visitor list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance + 20 }]}
        showsVerticalScrollIndicator={false}
      >
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : currentList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Feather name="shield" size={32} color={theme.colors.border} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'pending' ? 'No pending visitors' : activeTab === 'approved' ? 'No approved visitors' : 'No visitors inside'}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'pending' ? 'Visitors waiting for resident approval will appear here.' : activeTab === 'approved' ? 'Pre-approved visitors ready for check-in will appear here.' : 'Visitors currently inside the property will appear here.'}
              </Text>
            </View>
          ) : (
            <View key={listKey} style={{ gap: 10 }}>
              {currentList.map((visitor, i) => renderVisitorCard(visitor, activeTab, i))}
            </View>
          )}
        </ScrollView>

      {/* Unannounced Arrival Modal */}
      <UnannouncedArrivalModal
        visible={isUnannouncedVisible}
        onClose={() => setIsUnannouncedVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['security-gate'] });
          setIsUnannouncedVisible(false);
        }}
      />

      {/* Handoff Modal */}
      <Modal visible={Boolean(handoffModalVisitor)} transparent animationType="fade" onRequestClose={() => setHandoffModalVisitor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setHandoffModalVisitor(null)} />
          <View style={styles.handoffSheet}>
            <View style={styles.handoffHandle} />
            <Text style={styles.handoffTitle}>Record delivery handoff</Text>
            <Text style={styles.handoffSubtitle}>
              {handoffModalVisitor?.provider || handoffModalVisitor?.name || 'Delivery'}
            </Text>

            <Text style={styles.handoffLabel}>Hand off to</Text>
            <View style={styles.handoffOptions}>
              {(['RESIDENT', 'GATE', 'LOCKER'] as const).map((type) => (
                <PremiumPressable
                  key={type}
                  style={[styles.handoffOption, handoffType === type && styles.handoffOptionActive]}
                  onPress={() => setHandoffType(type)}
                >
                  <Feather
                    name={type === 'RESIDENT' ? 'user' : type === 'GATE' ? 'shield' : 'lock'}
                    size={16}
                    color={handoffType === type ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                  <Text style={[styles.handoffOptionText, handoffType === type && styles.handoffOptionTextActive]}>
                    {type === 'RESIDENT' ? 'Resident' : type === 'GATE' ? 'Gate hold' : 'Locker'}
                  </Text>
                </PremiumPressable>
              ))}
            </View>

            {handoffType === 'RESIDENT' ? (
              <TextInput
                style={styles.handoffInput}
                placeholder="Recipient name (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={handoffName}
                onChangeText={setHandoffName}
              />
            ) : null}

            <View style={styles.handoffActions}>
              <Button
                label="Cancel"
                variant="outline"
                size="md"
                onPress={() => { setHandoffModalVisitor(null); setHandoffName(''); setHandoffType('RESIDENT'); }}
                style={{ flex: 1 }}
              />
              <Button
                label={handoffMutation.isPending ? 'Recording...' : 'Record handoff'}
                variant="primary"
                size="md"
                onPress={handleHandoff}
                disabled={handoffMutation.isPending}
                loading={handoffMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerLeft: { flex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary },
  headerSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  newArrivalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  newArrivalBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#FFFFFF' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  summaryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5 },

  // Filter
  filterBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: theme.colors.textSecondary },
  tabBadgeTextActive: { color: '#FFFFFF' },

  // Flow hint
  flowHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 4, marginTop: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#EAF4EC' },
  flowHintText: { flex: 1, color: '#42634C', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17 },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textPrimary },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 18 },

  // Card
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, flex: 1 },
  preApprovedBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  preApprovedText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#059669', letterSpacing: 0.3 },
  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: theme.colors.textSecondary },

  // Card actions
  cardAction: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: '#D97706' },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpInput: { flex: 1, height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textPrimary, letterSpacing: 4 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 16, borderRadius: 10 },
  verifyBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  checkInBtn: { borderRadius: 10 },

  checkedInRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkedInTime: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary },
  actionBtns: { flexDirection: 'row', gap: 8 },
  handoffBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#A16207', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  handoffBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  checkOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  checkOutBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#DC2626' },
  btnDisabled: { opacity: 0.5 },

  // Handoff modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.42)' },
  handoffSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  handoffHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 16 },
  handoffTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 2 },
  handoffSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 },
  handoffLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 },
  handoffOptions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  handoffOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  handoffOptionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  handoffOptionText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  handoffOptionTextActive: { color: '#FFFFFF' },
  handoffInput: { height: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 },
  handoffActions: { flexDirection: 'row', gap: 10 },
});
