import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Button } from '../../../src/components/ui/Button';
import { AddVisitorModal } from '../../../src/components/add-visitor-modal';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { theme } from '../../../src/theme';
import { smartBack } from '../../../src/navigation/history';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { isActiveVisitor, isGuestVisitor, visitorsApi, VisitorItem } from '../../../src/api/visitors';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function VisitorsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState<'VISITORS' | 'SERVICE' | 'CABS' | 'DELIVERIES'>('VISITORS');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['my-visitors'],
    queryFn: () => visitorsApi.getMyVisitors(),
    refetchInterval: 15000,
  });

  const visitors = data?.visitors || [];

  const { upcomingVisitors, historyVisitors } = useMemo(() => {
    // Filter only GUEST and SERVICE as requested (hide Cab/Delivery in this phase if desired, or include them? The prompt says: "filters for Guest and Service... Do not alter cab or delivery UI in this phase." I will just show all or filter if needed.)
    const categoryFiltered = visitors.filter(v => {
      if (category === 'CABS') return v.visitorType === 'CAB';
      if (category === 'DELIVERIES') return v.visitorType === 'DELIVERY';
      if (category === 'SERVICE') return v.visitorType === 'SERVICE';
      return isGuestVisitor(v);
    });
    const upcoming = categoryFiltered.filter(isActiveVisitor);
    const history = categoryFiltered.filter(v => ['CHECKED_OUT', 'REJECTED', 'REVOKED', 'EXPIRED'].includes(v.status));
    return { upcomingVisitors: upcoming, historyVisitors: history };
  }, [visitors, category]);

  const displayedVisitors = activeTab === 'upcoming' ? upcomingVisitors : historyVisitors;

  const renderVisitorCard = (v: VisitorItem, index: number) => {
    const isCheckedIn = v.status === 'CHECKED_IN';
    const isApproved = v.status === 'APPROVED';
    const isRejected = v.status === 'REJECTED';
    const isRevoked = v.status === 'REVOKED';

    return (
      <ScreenEntrance key={v.id} delay={index * 40} animation="rise" distance={20}>
        <PremiumPressable
          style={[styles.card, (isRejected || isRevoked) && styles.cardRejected]}
          onPress={() => router.push(`/visitors/${v.id}` as any)}
          scaleTo={0.98}
        >
          <View style={styles.cardHeader}>
            <View style={[
              styles.avatar, 
              isCheckedIn && styles.avatarCheckedIn, 
              (isRejected || isRevoked) && styles.avatarRejected
            ]}>
              <Feather name={v.visitorType === 'DELIVERY' ? 'package' : v.visitorType === 'CAB' ? 'map-pin' : 'user'} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.visitorName}>{v.visitorType === 'DELIVERY' || v.visitorType === 'CAB' ? (v.provider || v.name || v.visitorType) : v.name}</Text>
              <Text style={styles.visitorMeta}>
                {v.visitorType === 'DELIVERY' && v.orderReference ? `Order: ${v.orderReference} · ` : ''}
                {v.visitorType === 'CAB' && v.vehicleNumber ? `${v.vehicleNumber} · ` : ''}
                {new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                isApproved && styles.statusApproved,
                isCheckedIn && styles.statusCheckedIn,
                v.status === 'CHECKED_OUT' && styles.statusCheckedOut,
                (isRejected || isRevoked) && styles.statusRejected,
                v.status === 'PENDING' && styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isApproved && styles.statusTextApproved,
                  isCheckedIn && styles.statusTextCheckedIn,
                  v.status === 'CHECKED_OUT' && styles.statusTextCheckedOut,
                  (isRejected || isRevoked) && styles.statusTextRejected,
                  v.status === 'PENDING' && styles.statusTextPending,
                ]}
              >
                {isCheckedIn ? 'Inside' : 
                 isApproved ? 'Approved' : 
                 v.status === 'PENDING' ? 'Pending' : 
                 v.status === 'CHECKED_OUT' ? 'Checked Out' : 
                 isRevoked ? 'Revoked' : 'Declined'}
              </Text>
            </View>
          </View>
        </PremiumPressable>
      </ScreenEntrance>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Access Passes"
        onBackPress={() => smartBack(router, '/services')}
      />

      
      <View style={styles.categoryTabs}>
        <PremiumPressable style={[styles.categoryTab, category === 'VISITORS' && styles.categoryTabActive]} onPress={() => setCategory('VISITORS')}>
          <Text style={[styles.categoryTabText, category === 'VISITORS' && styles.categoryTabTextActive]}>Guests</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.categoryTab, category === 'SERVICE' && styles.categoryTabActive]} onPress={() => setCategory('SERVICE')}>
          <Text style={[styles.categoryTabText, category === 'SERVICE' && styles.categoryTabTextActive]}>Service</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.categoryTab, category === 'CABS' && styles.categoryTabActive]} onPress={() => setCategory('CABS')}>
          <Text style={[styles.categoryTabText, category === 'CABS' && styles.categoryTabTextActive]}>Cabs</Text>
        </PremiumPressable>
        <PremiumPressable style={[styles.categoryTab, category === 'DELIVERIES' && styles.categoryTabActive]} onPress={() => setCategory('DELIVERIES')}>
          <Text style={[styles.categoryTabText, category === 'DELIVERIES' && styles.categoryTabTextActive]}>Deliveries</Text>
        </PremiumPressable>
      </View>

      <View style={styles.tabs}>
        <PremiumPressable
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming / Active</Text>
          {upcomingVisitors.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{upcomingVisitors.length}</Text>
            </View>
          )}
        </PremiumPressable>
        <PremiumPressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance + 90 }]}
        refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
            <Skeleton height={80} borderRadius={18} />
          </View>
        ) : displayedVisitors.length > 0 ? (
          displayedVisitors.map((v, i) => renderVisitorCard(v, i))
        ) : (
          <EmptyState
            icon="shield"
            title={activeTab === 'upcoming' ? 'No expected records' : 'No history'}
            description={
              activeTab === 'upcoming'
                ? category === 'DELIVERIES' ? 'Register an expected delivery to ensure smooth gate handoff.' : category === 'CABS' ? 'Register an expected cab for quick gate entry.' : category === 'SERVICE' ? 'Register house help or another service worker for gate access.' : 'Create a pre-approved entry pass to grant someone fast access at the gate.'
                : category === 'DELIVERIES' ? 'No past deliveries found for your unit.' : category === 'CABS' ? 'No past cabs found for your unit.' : category === 'SERVICE' ? 'No past service-worker passes found for your unit.' : 'No past visitor records found for your unit.'
            }
          />
        )}
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: bottomClearance || 24 }]}>
        <Button label="Create Access Pass" icon="plus" onPress={() => setShowAddModal(true)} />
      </View>

      <AddVisitorModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        initialVisitorType={category === 'SERVICE' ? 'SERVICE' : undefined}
        onSuccess={() => refetch()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  categoryTabs: { flexDirection: 'row', paddingHorizontal: cardSystem.pagePadding, paddingTop: 10, paddingBottom: 5, gap: 8 },
  categoryTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 98, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'transparent' },
  categoryTabActive: { backgroundColor: '#ECFDF5', borderColor: theme.colors.primary },
  categoryTabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  categoryTabTextActive: { color: theme.colors.primary },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: cardSystem.pagePadding,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14.5, color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },
  badge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 98,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.primary,
  },
  listContent: { padding: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRejected: {
    backgroundColor: '#F9FAFB',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarCheckedIn: { backgroundColor: '#EFF6FF' },
  avatarRejected: { backgroundColor: '#FEE2E2' },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: theme.colors.primary,
  },
  cardInfo: { flex: 1 },
  visitorName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  visitorMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusPending: { backgroundColor: '#FFF7ED' },
  statusApproved: { backgroundColor: '#ECFDF5' },
  statusCheckedIn: { backgroundColor: '#EFF6FF' },
  statusCheckedOut: { backgroundColor: '#F3F4F6' },
  statusRejected: { backgroundColor: '#FEF2F2' },
  
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },
  statusTextPending: { color: '#C2410C' },
  statusTextApproved: { color: '#047857' },
  statusTextCheckedIn: { color: '#1D4ED8' },
  statusTextCheckedOut: { color: '#6B7280' },
  statusTextRejected: { color: '#B91C1C' },

  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
});
