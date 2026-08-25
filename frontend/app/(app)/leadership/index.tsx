import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Animated } from 'react-native';
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
import { cardSystem, cardSurface } from '../../../src/components/ui/cardSystem';
import { homeLayout } from '../../../src/components/home/homeSurface';

export default function LeadershipOverviewScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { user, hasLeadershipAccess, hasResidentAccess, hasOwnerAccess, hasManagerAccess, hasWorkforceAccess, hasApprovedMembership } = useSession();

  const [data, setData] = useState<LeadershipOverviewResponse | null>(null);
  const [pendingList, setPendingList] = useState<PendingManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Security guard: If user does not have approved leadership membership, redirect away
  useEffect(() => {
    if (!hasLeadershipAccess()) {
      if (hasResidentAccess() || hasOwnerAccess()) {
        router.replace('/(app)/home');
      } else {
        router.replace('/(app)/manager');
      }
    }
  }, [hasLeadershipAccess, hasResidentAccess, hasOwnerAccess, hasManagerAccess, hasWorkforceAccess, router]);

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
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
      setLoadError(overviewRes.status === 'rejected' && pendingRes.status === 'rejected');
    } catch (err) {
      setLoadError(true);
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

  const displayName = `${user?.firstName || 'Leader'} ${user?.lastName || ''}`.trim();
  const stats = data?.stats;
  const pendingManagersCount = pendingList.length || stats?.pendingManagers || 0;

  const handleLeaveLeadership = () => {
    if (hasResidentAccess() || hasOwnerAccess()) {
      router.replace('/(app)/home');
      return;
    }
    router.back();
  };

  // Check if user has view-only access
  const isViewOnly = hasLeadershipAccess() && !hasApprovedMembership('LEADERSHIP');

  // Parallax scroll
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Leadership Governance"
        showBack
        onBackPress={handleLeaveLeadership}
        rightAction={
          <PremiumPressable
            onPress={() => router.push('/notifications')}
            style={styles.notifBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Feather name="bell" size={20} color={theme.colors.textPrimary} />
            {pendingManagersCount > 0 && <View style={styles.notifDot} />}
          </PremiumPressable>
        }
      />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loadError && (
          <View style={styles.errorCard}>
            <Feather name="wifi-off" size={22} color={theme.status.warning.foreground} />
            <View style={styles.errorCardBody}>
              <Text style={styles.errorTitle}>Governance data is unavailable</Text>
              <Text style={styles.errorDescription}>Check your connection and try again.</Text>
            </View>
            <PremiumPressable
              style={styles.retryBtn}
              onPress={loadData}
              accessibilityLabel="Retry loading governance data"
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Retry</Text>
            </PremiumPressable>
          </View>
        )}

        {/* Hero Section with Parallax */}
        <Animated.View style={[styles.heroWrapper, { transform: [{ translateY: heroTranslateY }] }]}>
          <ScreenEntrance delay={40}>
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Feather name="shield" size={13} color={theme.colors.onPrimary} />
                <Text style={styles.heroBadgeText}>TOWNSHIP LEADERSHIP</Text>
              </View>
              <Text style={styles.heroTitle}>Good day, {displayName}</Text>
              <Text style={styles.heroSub}>
                Regency Salma Governance &amp; Operational Oversight
              </Text>
            </View>
          </ScreenEntrance>
        </Animated.View>

        {/* Body Sections */}
        <View style={[styles.bodyWrapper, { paddingBottom: bottomClearance + 40 }]}>
        {isViewOnly && (
          <ScreenEntrance delay={60} animation="rise" distance={10}>
            <View style={styles.infoCard}>
              <Feather name="info" size={16} color={theme.colors.textTertiary} />
              <Text style={styles.infoText}>
                You have view-only access. Contact leadership for full administrative privileges.
              </Text>
            </View>
          </ScreenEntrance>
        )}

        {/* Pending Actions / Approvals Card */}
        <ScreenEntrance delay={80}>
          {pendingManagersCount > 0 ? (
            <PremiumPressable
              style={styles.pendingActionCard}
              onPress={() => router.push('/leadership/approvals')}
              accessibilityLabel={`${pendingManagersCount} manager applications pending review`}
              accessibilityRole="button"
            >
              <View style={styles.pendingIconBox}>
                <Feather name="alert-circle" size={24} color={theme.status.warning.foreground} />
              </View>
              <View style={styles.pendingCardBody}>
                <Text style={styles.pendingCardTitle}>
                  {pendingManagersCount} Manager Application{pendingManagersCount > 1 ? 's' : ''} Pending
                </Text>
                <Text style={styles.pendingCardDesc}>
                  Leadership review is required to activate Operations Manager access.
                </Text>
              </View>
              <View style={styles.reviewBtnPill}>
                <Text style={styles.reviewBtnText}>Review</Text>
                <Feather name="chevron-right" size={16} color={theme.colors.onPrimary} />
              </View>
            </PremiumPressable>
          ) : (
            <View style={styles.upToDateCard}>
              <Feather name="check-circle" size={18} color={theme.status.success.foreground} />
              <Text style={styles.upToDateText}>All manager applications are up to date</Text>
            </View>
          )}
        </ScreenEntrance>

        {/* Core Community Overview Metrics */}
        <ScreenEntrance delay={120}>
          <Text style={styles.sectionTitle}>Community Overview</Text>
          {loading && !data ? (
            <>
              <View style={styles.metricsRow}>
                <View style={styles.metricSkeletonCell}><Skeleton height={100} style={styles.skeletonRadius} /></View>
                <View style={styles.metricsRowGap} />
                <View style={styles.metricSkeletonCell}><Skeleton height={100} style={styles.skeletonRadius} /></View>
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metricSkeletonCell}><Skeleton height={100} style={styles.skeletonRadius} /></View>
                <View style={styles.metricsRowGap} />
                <View style={styles.metricSkeletonCell}><Skeleton height={100} style={styles.skeletonRadius} /></View>
              </View>
            </>
          ) : (
            <>
              {/* Row 1 */}
              <View style={styles.metricsRow}>
                <PremiumPressable
                  style={[styles.metricCard, { flex: 1 }]}
                  onPress={() => router.push('/leadership/approvals')}
                  accessibilityLabel={`${stats?.pendingWorkforce ?? 0} pending workforce`}
                  accessibilityRole="button"
                  scaleTo={0.96}
                >
                  <View style={[styles.metricIconBox, { backgroundColor: theme.status.success.background }]}>
                    <Feather name="user-plus" size={18} color={theme.status.success.foreground} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.pendingWorkforce ?? 0}</Text>
                  <Text style={styles.metricLabel}>Pending Workforce</Text>
                </PremiumPressable>

                <View style={styles.metricsRowGap} />

                <PremiumPressable
                  style={[styles.metricCard, { flex: 1 }]}
                  onPress={() => router.push('/leadership/approvals')}
                  accessibilityLabel={`${pendingManagersCount} pending approvals`}
                  accessibilityRole="button"
                  scaleTo={0.96}
                >
                  <View style={[styles.metricIconBox, { backgroundColor: theme.status.warning.background }]}>
                    <Feather name="clock" size={18} color={theme.status.warning.foreground} />
                  </View>
                  <Text style={[styles.metricValue, { color: theme.status.warning.foreground }]}>{pendingManagersCount}</Text>
                  <Text style={styles.metricLabel}>Pending Approvals</Text>
                </PremiumPressable>
              </View>

              <View style={styles.metricsRowGap} />

              {/* Row 2 */}
              <View style={styles.metricsRow}>
                <PremiumPressable
                  style={[styles.metricCard, { flex: 1 }]}
                  onPress={() => router.push('/leadership/approvals')}
                  accessibilityLabel={`${stats?.totalPersonnel ?? 0} active workforce members`}
                  accessibilityRole="button"
                  scaleTo={0.96}
                >
                  <View style={[styles.metricIconBox, { backgroundColor: theme.status.info.background }]}>
                    <Feather name="users" size={18} color={theme.status.info.foreground} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.totalPersonnel ?? 0}</Text>
                  <Text style={styles.metricLabel}>Active Workforce</Text>
                </PremiumPressable>

                <View style={styles.metricsRowGap} />

                <PremiumPressable
                  style={[styles.metricCard, { flex: 1 }]}
                  onPress={() => router.push('/leadership/tickets')}
                  accessibilityLabel={`${stats?.activeTickets ?? 0} active issues`}
                  accessibilityRole="button"
                  scaleTo={0.96}
                >
                  <View style={[styles.metricIconBox, { backgroundColor: theme.status.danger.background }]}>
                    <Feather name="tool" size={18} color={theme.status.danger.foreground} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.activeTickets ?? 0}</Text>
                  <Text style={styles.metricLabel}>Active Issues</Text>
                </PremiumPressable>
              </View>
            </>
          )}
        </ScreenEntrance>

        {/* Workforce Breakdown */}
        <ScreenEntrance delay={160}>
          <Text style={styles.sectionTitle}>Workforce Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.summaryIconBox, { backgroundColor: theme.status.success.background }]}>
                  <Feather name="shield" size={14} color={theme.status.success.foreground} />
                </View>
                <Text style={styles.summaryLabel}>Security Staff</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.security ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.summaryIconBox, { backgroundColor: theme.status.info.background }]}>
                  <Feather name="tool" size={14} color={theme.status.info.foreground} />
                </View>
                <Text style={styles.summaryLabel}>Maintenance / Technical</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.maintenance ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.summaryIconBox, { backgroundColor: theme.status.warning.background }]}>
                  <Feather name="home" size={14} color={theme.status.warning.foreground} />
                </View>
                <Text style={styles.summaryLabel}>Housekeeping / Cleaning</Text>
              </View>
              <Text style={styles.summaryCount}>{stats?.workforceBreakdown?.housekeeping ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <View style={[styles.summaryIconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <Feather name="users" size={14} color={theme.colors.textTertiary} />
                </View>
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
              accessibilityLabel="Create new announcement"
              accessibilityRole="button"
            >
              <Feather name="plus-circle" size={15} color={theme.colors.primary} />
              <Text style={styles.actionLinkText}>New Notice</Text>
            </PremiumPressable>
          </View>

          {data?.recentAnnouncements && data.recentAnnouncements.length > 0 ? (
            data.recentAnnouncements.map((ann) => (
              <View key={ann.id} style={styles.announcementCard}>
                <View style={styles.announcementIconBox}>
                  <Feather name="volume-2" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.announcementCardBody}>
                  <Text style={styles.announcementCardTitle}>{ann.title}</Text>
                  <Text style={styles.announcementCardMeta}>
                    By {ann.authorName} · {new Date(ann.createdAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.announcementCardText} numberOfLines={2}>
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
                    <View style={[styles.activityDot, { backgroundColor: appr.role === 'MANAGER' ? theme.status.success.foreground : theme.status.info.foreground }]} />
                    <View style={styles.activityInfo}>
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
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  heroWrapper: {
    position: 'relative',
    minHeight: 180,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  bodyWrapper: {
    marginTop: -24,
    paddingTop: 16,
    paddingHorizontal: cardSystem.pagePadding,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 6,
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
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    padding: 20,
    marginHorizontal: cardSystem.pagePadding,
    marginTop: 12,
    marginBottom: 24,
    shadowColor: theme.colors.primary,
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
    borderRadius: theme.radii.pill,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.onPrimary,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: theme.colors.onPrimary,
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
    backgroundColor: theme.status.warning.background,
    borderColor: theme.status.warning.border,
    borderWidth: 1,
    borderRadius: cardSystem.radius,
    padding: cardSystem.padding + 4,
    marginBottom: 20,
    gap: 12,
  },
  pendingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: theme.status.warning.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingCardBody: {
    flex: 1,
  },
  pendingCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.status.warning.foreground,
    marginBottom: 2,
  },
  pendingCardDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.status.warning.foreground,
    lineHeight: 16,
  },
  reviewBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.status.warning.foreground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
  },
  reviewBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.onPrimary,
  },
  upToDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.status.success.background,
    borderColor: theme.status.success.border,
    borderWidth: 1,
    borderRadius: cardSystem.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  upToDateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.status.success.foreground,
  },
  sectionTitle: {
    ...homeLayout.sectionTitle,
    marginBottom: 12,
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
    backgroundColor: theme.status.success.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
  },
  actionLinkText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metricsRowGap: {
    width: 12,
  },
  metricSkeletonCell: {
    flex: 1,
  },
  skeletonRadius: {
    borderRadius: 14,
  },
  metricCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  summaryCard: {
    ...cardSurface,
    padding: cardSystem.padding + 4,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: theme.colors.surfaceMuted,
    marginVertical: 4,
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...cardSurface,
    padding: cardSystem.padding + 4,
    marginBottom: 12,
    gap: 12,
  },
  announcementIconBox: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: theme.status.success.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementCardBody: {
    flex: 1,
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
  announcementCardText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  activityListCard: {
    ...cardSurface,
    padding: cardSystem.padding + 4,
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
    borderRadius: 4,
  },
  activityInfo: {
    flex: 1,
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
    color: theme.colors.textTertiary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.status.warning.background,
    borderColor: theme.status.warning.border,
    borderWidth: 1,
    borderRadius: cardSystem.radius,
    padding: 14,
    marginBottom: 16,
  },
  errorCardBody: {
    flex: 1,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.status.warning.foreground,
  },
  errorDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: theme.status.warning.foreground,
    marginTop: 2,
  },
  retryBtn: {
    backgroundColor: theme.status.warning.foreground,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.onPrimary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.status.info.background,
    borderColor: theme.status.info.border,
    borderWidth: 1,
    borderRadius: cardSystem.radius,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.status.info.foreground,
    flex: 1,
  },
});
