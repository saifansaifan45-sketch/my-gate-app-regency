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
        <View style={[styles.header, { paddingTop: top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => smartBack(router, '/work')} hitSlop={8}>
            <Feather name="arrow-left" size={22} color="#111827" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Gate Activity Log</Text>
            <Text style={styles.headerSubtitle}>Recent check-ins, approvals & operations</Text>
          </View>
        </View>
      </ScreenEntrance>
      
      <ScreenEntrance delay={50} distance={8}>
        <View style={styles.searchContainer}>
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
            <PremiumPressable onPress={() => setUnitFilter('')}>
              <Feather name="x" size={16} color={theme.colors.textSecondary} />
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
          >
            <Text style={[styles.filterChipText, activityFilter === value && styles.filterChipTextActive]}>{label}</Text>
          </PremiumPressable>
        ))}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <ScreenEntrance delay={80}>
              <View style={styles.emptyWrap}>
                <Feather name="file-text" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No activity found</Text>
                <Text style={styles.emptyDesc}>{activityFilter === 'ALL' ? 'No recent gate activity found.' : 'Try another activity filter.'}</Text>
              </View>
            </ScreenEntrance>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#111827' },
  headerSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 20, marginBottom: 10, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10, flexWrap: 'wrap' },
  filterChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.primary },
  timeText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#6B7280' },
  visitorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  visitorName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#111827' },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#4B5563' },
  expiredBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  expiredBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#B91C1C' },
  unitText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  actorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#6B7280', marginTop: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: '#374151' },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#6B7280' }
});
