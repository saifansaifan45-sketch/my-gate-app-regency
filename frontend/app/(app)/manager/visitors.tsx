import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Linking, Alert, TextInput as RNTextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitorsApi, VisitorStatus, VisitorItem } from '../../../src/api/visitors';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Button } from '../../../src/components/ui/Button';
import { theme } from '../../../src/theme';
import { smartBack } from '../../../src/navigation/history';
import { cardSystem } from '../../../src/components/ui/cardSystem';

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

type ViewMode = 'QUEUE' | 'EXCEPTIONS' | 'HISTORY';
type TabType = 'arrivals' | 'deliveries' | 'cabs' | 'inside';

export default function GateOperationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('QUEUE');
  const [activeTab, setActiveTab] = useState<TabType>('arrivals');
  const [searchQuery, setSearchQuery] = useState('');

  // Queue fetching (Gate operational API)
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ['gate-visitors'],
    queryFn: () => visitorsApi.getGateVisitors(),
    refetchInterval: 30000,
  });

  // History fetching (Manager audit API)
  const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['gate-history'],
    queryFn: () => visitorsApi.getGateHistory(),
    enabled: viewMode === 'HISTORY' || viewMode === 'EXCEPTIONS',
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

  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');

  // Filtering
  const { arrivals, deliveries, cabs, inside } = useMemo(() => {
    const sq = searchQuery.toLowerCase();
    const searchable = sq ? rawQueue.filter(v => 
      (v.name.toLowerCase().includes(sq)) || 
      (v.provider && v.provider.toLowerCase().includes(sq)) ||
      (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(sq)) ||
      (v.unit?.unitNumber.toLowerCase().includes(sq)) ||
      (v.orderReference && v.orderReference.toLowerCase().includes(sq))
    ) : rawQueue;

    return {
      arrivals: searchable.filter(v => (v.visitorType === 'GUEST' || v.visitorType === 'SERVICE') && v.status !== 'CHECKED_IN' && v.status !== 'CHECKED_OUT' && v.status !== 'REJECTED' && v.status !== 'REVOKED' && v.status !== 'EXPIRED'),
      deliveries: searchable.filter(v => v.visitorType === 'DELIVERY' && v.status !== 'CHECKED_OUT' && v.status !== 'REJECTED' && v.status !== 'REVOKED' && v.status !== 'EXPIRED'),
      cabs: searchable.filter(v => v.visitorType === 'CAB' && v.status !== 'CHECKED_OUT' && v.status !== 'REJECTED' && v.status !== 'REVOKED' && v.status !== 'EXPIRED'),
      inside: searchable.filter(v => v.status === 'CHECKED_IN'),
    };
  }, [rawQueue, searchQuery]);

  const activeQueue = activeTab === 'arrivals' ? arrivals : activeTab === 'deliveries' ? deliveries : activeTab === 'cabs' ? cabs : inside;

  // History Filtering
  const historyList = useMemo(() => {
    const sq = searchQuery.toLowerCase();
    return sq ? rawHistory.filter(v => v.name.toLowerCase().includes(sq) || v.unit?.unitNumber.toLowerCase().includes(sq)) : rawHistory;
  }, [rawHistory, searchQuery]);

  // Exceptions Filtering
  const exceptionsList = useMemo(() => {
    return rawHistory.filter(v => {
      // Checked out but no handoff for deliveries
      if (v.visitorType === 'DELIVERY' && v.status === 'CHECKED_OUT' && !v.handoffTimestamp) return true;
      // Overdue checked-in (inside for > 12 hours)
      if (v.status === 'CHECKED_IN' && v.checkInTime) {
        const hrs = (new Date().getTime() - new Date(v.checkInTime).getTime()) / (1000 * 60 * 60);
        if (hrs > 12) return true;
      }
      return false;
    });
  }, [rawHistory]);

  const isLoading = viewMode === 'QUEUE' ? isLoadingQueue : isLoadingHistory;
  const handleRefresh = viewMode === 'QUEUE' ? refetchQueue : refetchHistory;

  const renderCard = (v: VisitorItem) => {
    const meta = STATUS_META[v.status] || STATUS_META.PENDING;
    const time = new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const unitLabel = v.unit?.unitNumber || v.createdBy?.unitNumber;
    const isInside = v.status === 'CHECKED_IN';
    const isException = viewMode === 'EXCEPTIONS';

    let exceptionReason = '';
    if (isException) {
      if (v.visitorType === 'DELIVERY' && v.status === 'CHECKED_OUT' && !v.handoffTimestamp) {
        exceptionReason = 'Missing Delivery Handoff Record';
      } else if (v.status === 'CHECKED_IN') {
        exceptionReason = 'Overdue: Inside for > 12 Hours';
      }
    }

    return (
      <View key={v.id} style={[styles.card, isException && styles.cardException]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.visitorName}>{v.visitorType === 'DELIVERY' || v.visitorType === 'CAB' ? (v.provider || v.name || v.visitorType) : v.name}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{TYPE_LABEL[v.visitorType]}</Text>
              {unitLabel && (
                <>
                  <Text style={styles.cardMetaDot}>•</Text>
                  <Text style={styles.cardMeta}>Unit {unitLabel}</Text>
                </>
              )}
              {v.vehicleNumber && (
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

        {isException && (
          <View style={styles.exceptionNotice}>
            <Feather name="alert-triangle" size={14} color="#D97706" />
            <Text style={styles.exceptionNoticeText}>{exceptionReason}</Text>
          </View>
        )}

        {viewMode !== 'QUEUE' ? (
          <View style={styles.actionRow}>
            <PremiumPressable style={styles.auditBtn} onPress={() => router.push(`/manager/visitors/audit/${v.id}` as any)}>
              <Feather name="file-text" size={14} color={theme.colors.primary} />
              <Text style={styles.auditBtnText}>Inspect Audit Log</Text>
            </PremiumPressable>
          </View>
        ) : (
          <View style={styles.actionRow}>
            {v.status === 'APPROVED' && (
              <Button label="Check In" onPress={() => { setSelectedVisitorId(v.id); setOtpInput(''); }} size="sm" style={{ flex: 1 }} />
            )}
            {v.status === 'CHECKED_IN' && v.visitorType !== 'DELIVERY' && (
              <Button label="Check Out" onPress={() => checkOutMut.mutate(v.id)} variant="secondary" size="sm" style={{ flex: 1 }} />
            )}
            {v.status === 'CHECKED_IN' && v.visitorType === 'DELIVERY' && (
              <Button label="Handoff & Exit" onPress={() => router.push(`/manager/visitors/audit/${v.id}` as any)} variant="primary" size="sm" style={{ flex: 1 }} />
            )}
            <PremiumPressable style={styles.auditBtn} onPress={() => router.push(`/manager/visitors/audit/${v.id}` as any)}>
              <Feather name="chevron-right" size={18} color={theme.colors.primary} />
            </PremiumPressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Gate Operations" onBackPress={() => smartBack(router, '/manager')} />

      <View style={styles.viewModeTabs}>
        <PremiumPressable style={[styles.viewTab, viewMode === 'QUEUE' && styles.viewTabActive]} onPress={() => setViewMode('QUEUE')}>
          <Text style={[styles.viewTabText, viewMode === 'QUEUE' && styles.viewTabTextActive]}>Live Queue</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.viewTab, viewMode === 'EXCEPTIONS' && styles.viewTabActive]} onPress={() => setViewMode('EXCEPTIONS')}>
          <Text style={[styles.viewTabText, viewMode === 'EXCEPTIONS' && styles.viewTabTextActive]}>Exceptions {exceptionsList.length > 0 && `(${exceptionsList.length})`}</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.viewTab, viewMode === 'HISTORY' && styles.viewTabActive]} onPress={() => setViewMode('HISTORY')}>
          <Text style={[styles.viewTabText, viewMode === 'HISTORY' && styles.viewTabTextActive]}>Audit History</Text>
        </PremiumPressable>
      </View>

      
      {viewMode === 'QUEUE' && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{arrivals.filter(v => v.status === 'PENDING').length}</Text>
            <Text style={styles.metricLbl}>Pending</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{activeQueue.filter(v => v.status === 'APPROVED').length}</Text>
            <Text style={styles.metricLbl}>Expected</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{inside.length}</Text>
            <Text style={styles.metricLbl}>Inside</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{rawQueue.filter(v => v.status === 'CHECKED_OUT').length}</Text>
            <Text style={styles.metricLbl}>Completed</Text>
          </View>
        </View>
      )}

      {viewMode === 'QUEUE' && (
        <View style={styles.queueTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: cardSystem.pagePadding }}>
            {(['arrivals', 'deliveries', 'cabs', 'inside'] as TabType[]).map(t => (
              <PremiumPressable key={t} style={[styles.queueTab, activeTab === t && styles.queueTabActive]} onPress={() => setActiveTab(t)}>
                <Text style={[styles.queueTabText, activeTab === t && styles.queueTabTextActive]}>
                  {t === 'arrivals' ? 'Arrivals' : t === 'deliveries' ? 'Deliveries' : t === 'cabs' ? 'Cabs' : 'Inside'}
                </Text>
              </PremiumPressable>
            ))}
          </ScrollView>
        </View>
      )}

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

      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}>
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
          </View>
        ) : (
          (viewMode === 'QUEUE' ? activeQueue : viewMode === 'HISTORY' ? historyList : exceptionsList).map(renderCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: cardSystem.pagePadding, paddingTop: 16, paddingBottom: 4 },
  metricItem: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', marginHorizontal: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  metricVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 2 },
  metricLbl: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  viewModeTabs: { flexDirection: 'row', paddingHorizontal: cardSystem.pagePadding, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  viewTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  viewTabActive: { borderBottomColor: theme.colors.primary },
  viewTabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  viewTabTextActive: { color: theme.colors.primary },
  
  queueTabs: { flexDirection: 'row', paddingTop: 14, paddingBottom: 6 },
  queueTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 98, backgroundColor: '#F3F4F6', marginRight: 10 },
  queueTabActive: { backgroundColor: '#ECFDF5' },
  queueTabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  queueTabTextActive: { color: theme.colors.primary },

  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary },

  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingBottom: 100, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  cardException: { borderColor: '#F59E0B', borderWidth: 1.5, backgroundColor: '#FFFBEB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, paddingRight: 12 },
  visitorName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary },
  cardMetaDot: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#D1D5DB', marginHorizontal: 6 },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

  exceptionNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 12, gap: 6 },
  exceptionNoticeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#B45309' },

  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  auditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  auditBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.primary },
});
