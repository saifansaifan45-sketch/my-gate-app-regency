import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
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
import { managerApi, DashboardData, PendingWorkforceItem } from '../../../src/api/manager';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { useQuery } from '@tanstack/react-query';
import { getTimePeriod, getTimeGreeting } from '../../../src/components/home/TimeBasedBackground';

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { hasManagerAccess, hasResidentAccess, hasOwnerAccess } = useSession();
  const { containerWidth, pagePadding, isTablet } = useResponsive();

  const [currentPeriod, setCurrentPeriod] = useState(getTimePeriod());
  const greeting = getTimeGreeting(currentPeriod);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPeriod(getTimePeriod());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const GRID_GAP = 12;
  const METRIC_COLS = 2;
  const availableWidth = containerWidth - pagePadding * 2;
  const metricItemWidth = (availableWidth - GRID_GAP * (METRIC_COLS - 1)) / METRIC_COLS;

  // Security Guard: Only users with approved MANAGER can enter
  React.useEffect(() => {
    if (!hasManagerAccess()) {
      if (hasResidentAccess() || hasOwnerAccess()) {
        router.replace('/(app)/home');
      } else {
        router.replace('/(auth)/onboarding/relationship');
      }
    }
  }, [hasManagerAccess, hasResidentAccess, hasOwnerAccess, router]);

  const { data: dashboardData, isLoading: dashLoading, isError: dashError, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ['manager-dashboard'],
    queryFn: () => managerApi.getDashboard(),
    enabled: hasManagerAccess(),
    staleTime: 30_000,
  });

  const { data: pendingWorkforce = [], isLoading: pendingLoading, isError: workforceError, refetch: refetchWorkforce } = useQuery<PendingWorkforceItem[]>({
    queryKey: ['manager-pending-workforce'],
    queryFn: async () => {
      const res = await managerApi.getPendingWorkforce();
      return res.pendingWorkforce || [];
    },
    enabled: hasManagerAccess(),
    staleTime: 30_000,
  });

  const loading = dashLoading || pendingLoading;
  const data = dashboardData;

  const stats = data?.stats;
  const attendance = data?.attendanceStats;
  const pendingCount = pendingWorkforce.length;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Manager Operations"
        showNotification={true}
        hasUnreadNotifications={(stats?.pendingTickets || 0) > 0 || pendingCount > 0}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: pagePadding, paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {(dashError || workforceError) && (
          <View style={styles.errorCard}>
            <Feather name="wifi-off" size={22} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Some operations data is unavailable</Text>
              <Text style={styles.errorDescription}>You can retry without leaving this page.</Text>
            </View>
            <PremiumPressable
              style={styles.retryBtn}
              onPress={() => { refetchDashboard(); refetchWorkforce(); }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading operations data"
            >
              <Text style={styles.retryText}>Retry</Text>
            </PremiumPressable>
          </View>
        )}
        {/* Operations Hub Banner */}
        <ScreenEntrance delay={40}>
          <View style={styles.hubBanner}>
            <View style={styles.roleTag}>
              <Feather name="shield" size={13} color="#FFFFFF" />
              <Text style={styles.roleTagText}>REGENCY SALMA</Text>
            </View>
            <Text style={styles.hubTitle}>{greeting} Manager</Text>
            <Text style={styles.hubSubtitle}>
              Facility & Staff Operations
            </Text>
          </View>
        </ScreenEntrance>

        {/* Pending Workforce Approvals Action Card */}
        <ScreenEntrance delay={70}>
          {pendingCount > 0 ? (
            <PremiumPressable
              style={styles.pendingActionCard}
              onPress={() => router.push('/manager/approvals')}
            >
              <View style={styles.pendingIconBox}>
                <Feather name="user-plus" size={22} color="#B45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingCardTitle}>
                  {pendingCount} Workforce Application{pendingCount > 1 ? 's' : ''} Pending
                </Text>
                <Text style={styles.pendingCardDesc}>
                  Review technician & staff applications to grant township work access.
                </Text>
              </View>
              <View style={styles.reviewBtnPill}>
                <Text style={styles.reviewBtnText}>Review</Text>
                <Feather name="chevron-right" size={15} color="#FFFFFF" />
              </View>
            </PremiumPressable>
          ) : (
            <View style={styles.upToDateCard}>
              <Feather name="check-circle" size={16} color="#047857" />
              <Text style={styles.upToDateText}>All workforce applications reviewed</Text>
            </View>
          )}
        </ScreenEntrance>

        {/* Operations Metrics Grid */}
        <ScreenEntrance delay={100}>
          <Text style={styles.sectionTitle}>Operations Metrics</Text>
          {loading && !data ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <Skeleton width={metricItemWidth} height={90} style={{ borderRadius: 14 }} />
                <Skeleton width={metricItemWidth} height={90} style={{ borderRadius: 14 }} />
              </View>
              <View style={styles.metricsRow}>
                <Skeleton width={metricItemWidth} height={90} style={{ borderRadius: 14 }} />
                <Skeleton width={metricItemWidth} height={90} style={{ borderRadius: 14 }} />
              </View>
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <PremiumPressable style={[styles.metricCard, { width: metricItemWidth }]} onPress={() => router.push({ pathname: '/manager/tickets', params: { status: 'OPEN' } })} scaleTo={0.96}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="alert-circle" size={18} color="#D97706" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#D97706' }]}>{stats?.pendingTickets || 0}</Text>
                  <Text style={styles.metricLabel}>Open Tickets</Text>
                </PremiumPressable>

                <PremiumPressable style={[styles.metricCard, { width: metricItemWidth }]} onPress={() => router.push('/manager/tasks')} scaleTo={0.96}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Feather name="clock" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.metricValue}>{stats?.assignedTasks || 0}</Text>
                  <Text style={styles.metricLabel}>Assigned Tasks</Text>
                </PremiumPressable>
              </View>

              <View style={styles.metricsRow}>
                <PremiumPressable style={[styles.metricCard, { width: metricItemWidth }]} onPress={() => router.push('/manager/tasks')} scaleTo={0.96}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#F3E8FF' }]}>
                    <Feather name="activity" size={18} color="#7C3AED" />
                  </View>
                  <Text style={styles.metricValue}>{stats?.inProgressTasks || 0}</Text>
                  <Text style={styles.metricLabel}>In Progress</Text>
                </PremiumPressable>

                <PremiumPressable style={[styles.metricCard, { width: metricItemWidth }]} onPress={() => router.push('/manager/tasks')} scaleTo={0.96}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Feather name="check-circle" size={18} color="#059669" />
                  </View>
                  <Text style={styles.metricValue}>{stats?.completedTasks || 0}</Text>
                  <Text style={styles.metricLabel}>Completed Tasks</Text>
                </PremiumPressable>
              </View>
            </View>
          )}
        </ScreenEntrance>

        {/* Workforce Status Summary */}
        <ScreenEntrance delay={130}>
          <Text style={styles.sectionTitle}>Workforce Status</Text>
          <View style={styles.workforceCard}>
            <View style={styles.workforceGrid}>
              <View style={styles.wfStatCol}>
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.wfStatVal}>{stats?.availablePersonnel || 0}</Text>
                <Text style={styles.wfStatLabel}>Available</Text>
              </View>

              <View style={styles.wfStatCol}>
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.wfStatVal}>{stats?.busyPersonnel || stats?.inProgressTasks || 0}</Text>
                <Text style={styles.wfStatLabel}>On Task / Busy</Text>
              </View>

              <View style={styles.wfStatCol}>
                <View style={[styles.statusDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={styles.wfStatVal}>
                  {stats?.offDutyPersonnel || 0}
                </Text>
                <Text style={styles.wfStatLabel}>Off Duty</Text>
              </View>

              <View style={styles.wfStatCol}>
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.wfStatVal}>{stats?.onLeavePersonnel ?? attendance?.leave ?? 0}</Text>
                <Text style={styles.wfStatLabel}>On Leave</Text>
              </View>
            </View>
          </View>
        </ScreenEntrance>

        {/* Attendance Summary */}
        <ScreenEntrance delay={160}>
          <View style={styles.attendanceSummaryCard}>
            <View style={styles.attIconBox}>
              <Feather name="calendar" size={20} color="#047857" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attTitle}>Today's Attendance Summary</Text>
              <Text style={styles.attDesc}>
                {attendance?.present || 0} of {attendance?.totalStaff || stats?.totalPersonnel || 0} Personnel Present On Duty
              </Text>
            </View>
            <PremiumPressable
              style={styles.attViewBtn}
              onPress={() => router.push('/manager/attendance')}
            >
              <Text style={styles.attViewText}>View</Text>
              <Feather name="chevron-right" size={15} color={theme.colors.primary} />
            </PremiumPressable>
          </View>
        </ScreenEntrance>

        {/* Action Required: Pending Tickets List */}
        <ScreenEntrance delay={190}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Resident Tickets</Text>
            <PremiumPressable onPress={() => router.push('/manager/tickets')}>
              <Text style={styles.seeAllText}>View All</Text>
            </PremiumPressable>
          </View>

          {data?.pendingTicketsList && data.pendingTicketsList.length > 0 ? (
            data.pendingTicketsList.map((ticket) => (
              <PremiumPressable
                key={ticket.id}
                style={styles.pendingTicketCard}
                onPress={() => router.push(`/manager/tickets/${ticket.id}` as any)}
              >
                <View style={styles.ticketTop}>
                  <View style={styles.unitBadge}>
                    <Feather name="home" size={12} color={theme.colors.primary} />
                    <Text style={styles.unitText}>Unit {ticket.resident?.unitNumber || '9A'}</Text>
                  </View>
                  <View
                    style={[
                      styles.priorityPill,
                      ticket.priority === 'HIGH' || ticket.priority === 'URGENT' ? styles.urgentPill : styles.normalPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        ticket.priority === 'HIGH' || ticket.priority === 'URGENT' ? styles.urgentText : styles.normalText,
                      ]}
                    >
                      {ticket.priority}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>

                <View style={styles.ticketBottom}>
                  <Text style={styles.residentName}>
                    By {ticket.resident?.firstName || 'Resident'} {ticket.resident?.lastName || ''}
                  </Text>
                  <View style={styles.assignBtnPill}>
                    <Text style={styles.assignBtnText}>Assign Staff</Text>
                    <Feather name="arrow-right" size={14} color={theme.colors.primary} />
                  </View>
                </View>
              </PremiumPressable>
            ))
          ) : (
            <EmptyState
              icon="check-circle"
              title="All Caught Up!"
              description="No pending tickets require assignment at this moment."
            />
          )}
        </ScreenEntrance>

        {/* Recent Operations Activity */}
        <ScreenEntrance delay={220}>
          <Text style={styles.sectionTitle}>Recent Operations Activity</Text>
          <View style={styles.activityCard}>
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((act, index) => {
                const isLast = index === (data.recentActivity?.length || 0) - 1;
                return (
                  <View key={act.id} style={[styles.activityRow, isLast && { borderBottomWidth: 0 }]}>
                    <View
                      style={[
                        styles.activityDot,
                        act.type === 'COMPLAINT' && { backgroundColor: '#FEF3C7' },
                        act.type === 'TASK' && { backgroundColor: '#E0F2FE' },
                        act.type === 'ATTENDANCE' && { backgroundColor: '#ECFDF5' },
                      ]}
                    >
                      <Feather
                        name={act.type === 'COMPLAINT' ? 'alert-circle' : act.type === 'TASK' ? 'tool' : 'user-check'}
                        size={15}
                        color={act.type === 'COMPLAINT' ? '#D97706' : act.type === 'TASK' ? '#0284C7' : '#059669'}
                      />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>{act.title}</Text>
                      <Text style={styles.activityDesc} numberOfLines={1}>{act.description}</Text>
                    </View>
                    <Text style={styles.activityTime}>
                      {new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })
            ) : (
              <EmptyState
                icon="activity"
                title="No Recent Activity"
                description="Operational updates will stream here in real time."
              />
            )}
          </View>
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
  hubBanner: {
    backgroundColor: '#143D2A',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginBottom: 14,
  },
  roleTagText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  hubTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  hubSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
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
  metricsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
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
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  workforceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    marginBottom: 20,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  workforceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  wfStatCol: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginBottom: 6,
  },
  wfStatVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  wfStatLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  attendanceSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    marginBottom: 24,
    gap: 12,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  attIconBox: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  attDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#047857',
  },
  attViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 98,
  },
  attViewText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  pendingTicketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    marginBottom: 12,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  unitText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: theme.colors.textPrimary,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  urgentPill: {
    backgroundColor: '#FEE2E2',
  },
  normalPill: {
    backgroundColor: '#EFF6FF',
  },
  priorityText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
  },
  urgentText: {
    color: '#DC2626',
  },
  normalText: {
    color: '#2563EB',
  },
  ticketTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  ticketDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  ticketBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  residentName: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#6B7280',
  },
  assignBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: theme.colors.primary,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  activityDot: {
    width: 32,
    height: 32,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  activityDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  activityTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#9CA3AF',
  },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  errorTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#92400E' },
  errorDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#B45309', marginTop: 2 },
  retryBtn: { backgroundColor: '#B45309', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#FFFFFF' },
});
