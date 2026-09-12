import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, RefreshControl, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../src/theme';
import { api } from '../../../src/api/client';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';

interface GateActivityLogItem {
  id: string;
  action: string;
  createdAt: string;
  visitor?: { visitorName?: string; provider?: string; type: string; status?: string; unitNumber?: string };
  actor: { firstName?: string; lastName?: string; role?: string };
}

interface GateActivityResponse {
  logs: GateActivityLogItem[];
}

type ActivityFilter = 'ALL' | 'ARRIVALS' | 'CHECKOUTS' | 'DELIVERIES' | 'EXPIRY';

const ACTION_LABELS: Record<string, string> = {
  VISITOR_CHECK_IN: 'Visitor checked in',
  VISITOR_CHECK_OUT: 'Visitor checked out',
  VISITOR_AUTO_CHECK_OUT: 'Visitor auto-checked out',
  VISITOR_EXPIRED: 'Visitor pass expired',
  VISITOR_APPROVED: 'Visitor approved',
  VISITOR_REJECTED: 'Visitor rejected',
  VISITOR_REVOKED: 'Visitor pass revoked',
  VISITOR_UNANNOUNCED_ARRIVAL: 'Unannounced arrival',
  VISITOR_HANDOFF_SUGGESTED: 'Handoff preference saved',
  DELIVERY_HANDOFF: 'Delivery handed off',
  DELIVERY_CHECKOUT_EXCEPTION: 'Delivery checkout exception',
};

const ROLE_LABELS: Record<string, string> = {
  WORKFORCE: 'Security',
  MANAGER: 'Manager',
  LEADERSHIP: 'Leadership',
  RESIDENT: 'Resident',
  OWNER: 'Owner',
};

function formatAction(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function matchesActivityFilter(action: string, filter: ActivityFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'ARRIVALS') return action.includes('CHECK_IN') || action.includes('ARRIVAL') || action === 'VISITOR_APPROVED';
  if (filter === 'CHECKOUTS') return action.includes('CHECK_OUT');
  if (filter === 'DELIVERIES') return action.includes('DELIVERY') || action.includes('HANDOFF');
  return action.includes('EXPIRED');
}

export default function GateActivityLog() {
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);
  const [unitFilter, setUnitFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(unitFilter), 500);
    return () => clearTimeout(timer);
  }, [unitFilter]);

  const { data, isLoading, refetch, isRefetching } = useQuery<GateActivityResponse>({
    queryKey: ['gate-activity', debouncedFilter],
    queryFn: async () => {
      const res = await api.get('/visitors/gate/activity', { params: { unitLabel: debouncedFilter || undefined } });
      return res.data;
    },
    placeholderData: (previous) => previous,
    refetchInterval: 30000,
  });

  const logs = (data?.logs || []).filter((item) => matchesActivityFilter(item.action, activityFilter));

  const renderLog = ({ item, index }: { item: GateActivityLogItem; index: number }) => {
    return (
      <ScreenEntrance delay={Math.min(70 + index * 35, 220)} distance={8}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.actionText}>{formatAction(item.action)}</Text>
            <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          {item.visitor && (
            <View style={styles.visitorInfo}>
              <Text style={styles.visitorName}>{item.visitor.visitorName || item.visitor.provider}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.visitor.type}</Text>
              </View>
              {item.visitor.status === 'EXPIRED' ? (
                <View style={styles.expiredBadge}>
                  <Text style={styles.expiredBadgeText}>Expired</Text>
                </View>
              ) : null}
              {Boolean(item.visitor.unitNumber) && (
                <Text style={styles.unitText}>Unit {item.visitor.unitNumber}</Text>
              )}
            </View>
          )}
          <Text style={styles.actorText}>By: {item.actor.firstName} {item.actor.lastName} ({ROLE_LABELS[item.actor.role || ''] || 'Staff'})</Text>
        </View>
      </ScreenEntrance>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenEntrance animation="fade">
        <View style={[styles.header, { paddingTop: Math.max(top + 8, 20) }]}>
          <View style={styles.responsiveInner}>
            <View style={styles.headerTopRow}>
              <Pressable style={styles.backBtn} onPress={() => smartBack(router, '/work/index')} hitSlop={8}>
                <Feather name="arrow-left" size={20} color="#111827" />
              </Pressable>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Gate Activity Log</Text>
                <Text style={styles.headerSubtitle}>Recent check-ins, approvals & operations</Text>
              </View>
            </View>
          </View>
        </View>
      </ScreenEntrance>
      
      <View style={styles.mainContent}>
        <View style={styles.responsiveInner}>
          <ScreenEntrance delay={50} distance={8}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
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
                  <Feather name="x" size={15} color={theme.colors.textSecondary} />
                </PremiumPressable>
              ) : null}
            </View>
          </ScreenEntrance>

          <View style={styles.filterRow}>
            {([
              ['ALL', 'All'],
              ['ARRIVALS', 'Arrivals'],
              ['CHECKOUTS', 'Check-outs'],
              ['DELIVERIES', 'Deliveries'],
              ['EXPIRY', 'Expiry'],
            ] as const).map(([value, label]) => (
              <PremiumPressable
                key={value}
                style={[styles.filterChip, activityFilter === value && styles.filterChipActive]}
                onPress={() => setActivityFilter(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: activityFilter === value }}
                scaleTo={0.95}
              >
                <Text style={[styles.filterChipText, activityFilter === value && styles.filterChipTextActive]}>{label}</Text>
              </PremiumPressable>
            ))}
          </View>
        </View>

        {isLoading ? (
          <ScreenEntrance delay={80} animation="fade">
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          </ScreenEntrance>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            renderItem={renderLog}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
            ListEmptyComponent={
              <ScreenEntrance delay={80}>
                <View style={styles.emptyWrap}>
                  <Feather name="file-text" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No activity found</Text>
                  <Text style={styles.emptyDesc}>{activityFilter === 'ALL' ? 'No recent gate activity found.' : 'Try another activity filter.'}</Text>
                </View>
              </ScreenEntrance>
            }
          />
        )}
      </View>
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
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, letterSpacing: -0.4, color: theme.colors.textPrimary },
  headerSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: { flex: 1, height: 44, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13.5, color: theme.colors.textPrimary },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 98, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(20, 61, 42, 0.08)' },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  filterChipTextActive: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' },
  listContent: { paddingHorizontal: 20, paddingTop: 6, gap: 12, maxWidth: 720, alignSelf: 'center', width: '100%' },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    gap: 8,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: theme.colors.primary },
  timeText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary },
  visitorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  visitorName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: '#4B5563' },
  expiredBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  expiredBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#B91C1C' },
  unitText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary }
});
