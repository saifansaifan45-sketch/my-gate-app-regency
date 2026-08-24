import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { useSession } from '../../../src/store/auth';
import { leadershipApi, LeadershipOverviewResponse, PendingManagerItem } from '../../../src/api/leadership';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function LeadershipOverviewScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { user, hasLeadershipAccess, hasResidentAccess, hasOwnerAccess } = useSession();

  const [data, setData] = useState<LeadershipOverviewResponse | null>(null);
  const [pendingList, setPendingList] = useState<PendingManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Security guard: If user does not have approved leadership membership, redirect away
  useEffect(() => {
    if (!hasLeadershipAccess()) {
      if (hasResidentAccess() || hasOwnerAccess()) {
        router.replace('/(app)/home');
      } else {
        router.replace('/(app)/manager');
      }
    }
  }, [hasLeadershipAccess, hasResidentAccess, hasOwnerAccess, router]);

  const loadData = useCallback(async () => {
    try {
      const [overviewRes, pendingRes] = await Promise.allSettled([
        leadershipApi.getOverview(),
        leadershipApi.getPendingManagers(),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setData(overviewRes.value);
      }
      if (pendingRes.status === 'fulfilled') {
        setPendingList(pendingRes.value.pendingManagers || []);
      }
    } catch (err) {
      console.warn('Failed to load leadership overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const displayName = `${user?.firstName || 'President'} ${user?.lastName || ''}`.trim();
  const stats = data?.stats;
  const pendingManagersCount = pendingList.length || stats?.pendingManagers || 0;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Leadership Governance"
        rightAction={
          <PremiumPressable
            onPress={() => router.push('/notifications')}
            style={styles.notifBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bell" size={20} color={theme.colors.textPrimary} />
            {pendingManagersCount > 0 && <View style={styles.notifDot} />}
          </PremiumPressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Governance Greeting Header */}
        <ScreenEntrance delay={40}>
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Feather name="shield" size={13} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>TOWNSHIP LEADERSHIP</Text>
            </View>
            <Text style={styles.heroTitle}>Good day, {displayName}</Text>
            <Text style={styles.heroSub}>
              Regency Salma Governance & Operational Oversight
            </Text>
          </View>
        </ScreenEntrance>

        {/* Pending Actions / Approvals Card */}
        <ScreenEntrance delay={80}>
          {pendingManagersCount > 0 ? (
            <PremiumPressable
              style={styles.pendingActionCard}
              onPress={() => router.push('/leadership/approvals')}
            >
              <View style={styles.pendingIconBox}>
                <Feather name="alert-circle" size={24} color="#B45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingCardTitle}>
                  {pendingManagersCount} Manager Application{pendingManagersCount > 1 ? 's' : ''} Pending
                </Text>
                <Text style={styles.pendingCardDesc}>
                  Leadership review is required to activate Operations Manager access.
                </Text>
              </View>
              <View style={styles.reviewBtnPill}>
                <Text style={styles.reviewBtnText}>Review</Text>
                <Feather name="chevron-right" size={16} color="#FFFFFF" />
              </View>
            </PremiumPressable>
          ) : (
            <View style={styles.upToDateCard}>
              <Feather name="check-circle" size={18} color="#047857" />
              <Text style={styles.upToDateText}>All manager applications are up to date</Text>
            </View>
          )}
        </ScreenEntrance>

        {/* Core Community Overview Metrics */}
        <ScreenEntrance delay={120}>
          <Text style={styles.sectionTitle}>Community Overview</Text>
          {loading && !data ? (
            <View style={styles.metricsGrid}>
              <Skeleton width="48%" height={100} style={{ borderRadius: 14 }} />
              <Skeleton width="48%" height={100} style={{ borderRadius: 14 }} />
              <Skeleton width="48%" height={100} style={{ borderRadius: 14 }} />
              <Skeleton width="48%" height={100} style={{ borderRadius: 14 }} />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Feather name="user-check" size={20} color="#047857" />
                </View>
                <Text style={styles.metricValue}>{stats?.activeManagers ?? 0}</Text>
                <Text style={styles.metricLabel}>Active Managers</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Feather name="clock" size={20} color="#B45309" />
                </View>
                <Text style={[styles.metricValue, { color: '#B45309' }]}>{pendingManagersCount}</Text>
                <Text style={styles.metricLabel}>Pending Approvals</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="users" size={20} color="#1D4ED8" />
                </View>
                <Text style={styles.metricValue}>{stats?.totalPersonnel ?? 0}</Text>
                <Text style={styles.metricLabel}>Active Workforce</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconBox, { backgroundColor: '#FDF2F8' }]}>
                  <Feather name="tool" size={20} color="#BE185D" />
                </View>
                <Text style={styles.metricValue}>{stats?.activeTickets ?? 0}</Text>
                <Text style={styles.metricLabel}>Active Issues</Text>
              </View>
            </View>
          )}
        </ScreenEntrance>

        {/* Workforce Breakdown */}
        <ScreenEntrance delay={160}>
          <Text style={styles.sectionTitle}>Workforce Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.dotIcon, { backgroundColor: '#10B981' }]} />
                <Text style={styles.summaryLabel}>Security Staff</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.security ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.dotIcon, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.summaryLabel}>Maintenance / Technical</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.maintenance ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.dotIcon, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.summaryLabel}>Housekeeping / Cleaning</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.housekeeping ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.dotIcon, { backgroundColor: '#6B7280' }]} />
                <Text style={styles.summaryLabel}>Other Township Staff</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.other ?? 0}</Text>
            </View>
          </View>
        </ScreenEntrance>

        {/* Governance Announcements & Broadcast */}
        <ScreenEntrance delay={200}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Leadership Announcements</Text>
            <PremiumPressable
              onPress={() => router.push('/leadership/create-announcement')}
              style={styles.actionLinkBtn}
            >
              <Feather name="plus-circle" size={15} color={theme.colors.primary} />
              <Text style={styles.actionLinkText}>New Notice</Text>
            </PremiumPressable>
          </View>

          {data?.recentAnnouncements && data.recentAnnouncements.length > 0 ? (
            data.recentAnnouncements.map((ann) => (
              <View key={ann.id} style={styles.announcementCard}>
                <View style={styles.announcementIconBox}>
                  <Feather name="volume-2" size={18} color="#143D2A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.announcementCardTitle}>{ann.title}</Text>
                  <Text style={styles.announcementCardMeta}>
                    By {ann.authorName} · {new Date(ann.createdAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.announcementCardBody} numberOfLines={2}>
                    {ann.content}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="volume-x"
              title="No Announcements Yet"
              description="Broadcast official governance notices and community alerts to residents and staff."
            />
          )}
        </ScreenEntrance>

        {/* Recent Approvals Activity */}
        <ScreenEntrance delay={240}>
          <Text style={styles.sectionTitle}>Recent Approvals</Text>
          {data?.recentApprovals && data.recentApprovals.length > 0 ? (
            <View style={styles.activityListCard}>
              {data.recentApprovals.map((appr, idx) => (
                <View key={appr.id}>
                  <View style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: appr.role === 'MANAGER' ? '#047857' : '#1D4ED8' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{appr.userName}</Text>
                      <Text style={styles.activitySub}>
                        {appr.role} · {appr.email}
                      </Text>
                    </View>
                    <Text style={styles.activityTime}>
                      {new Date(appr.approvedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {idx < data.recentApprovals.length - 1 && <View style={styles.summaryDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="check-square"
              title="No Recent Approvals"
              description="Approved managers and personnel activities will be recorded here."
            />
          )}
        </ScreenEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 12,
  },
  notifBtn: {
    position: 'relative',
    padding: 6,
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  heroCard: {
    backgroundColor: '#143D2A',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  pendingActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  pendingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#92400E',
    marginBottom: 2,
  },
  pendingCardDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  reviewBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B45309',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 98,
  },
  reviewBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  upToDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  upToDateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#047857',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 98,
  },
  actionLinkText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotIcon: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  summaryCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    gap: 12,
  },
  announcementIconBox: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  announcementCardMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  announcementCardBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  activityListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  activityName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  activitySub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  activityTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#9CA3AF',
  },
});
