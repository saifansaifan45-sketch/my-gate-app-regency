import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { theme } from '../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/api/client';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSession } from '../../../src/store/auth';
import { useToast } from '../../../src/store/toast';
import { cardSystem } from '../../../src/components/ui/cardSystem';
import { getPersonnelRoleLabel } from '../../../src/utils/personnel';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { ConfirmationModal } from '../../../src/components/ui/ConfirmationModal';

export default function WorkforceDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, hasWorkforceAccess } = useSession();
  const { showToast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = React.useState(false);

  const requestLogout = () => {
    if (!isLoggingOut) setIsLogoutConfirmVisible(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      showToast({ title: 'Could not log out', message: 'Please try again.', type: 'error' });
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmVisible(false);
    }
  };

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
    enabled: hasWorkforceAccess(),
    staleTime: 30_000,
  });

  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }
  
  // If the user's membership is PENDING, the API returns 403 Forbidden or 404
  if (isError || (data && !data.personnelProfile)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Feather name="clock" size={64} color="#D1D5DB" />
        <Text style={{ marginTop: 16, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#111827' }}>Awaiting Approval</Text>
        <Text style={{ marginTop: 8, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
          Your workforce application is currently pending Manager approval.
        </Text>
        <Pressable
          onPress={requestLogout}
          disabled={isLoggingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          accessibilityState={{ disabled: isLoggingOut }}
          style={{ marginTop: 24, backgroundColor: '#FEF2F2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2' }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#EF4444' }}>{isLoggingOut ? 'Logging out…' : 'Logout'}</Text>
        </Pressable>
        <ConfirmationModal
          visible={isLogoutConfirmVisible}
          onClose={() => setIsLogoutConfirmVisible(false)}
          onConfirm={handleLogout}
          title="Log out?"
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          variant="danger"
          confirmIcon="log-out"
          loading={isLoggingOut}
        />
      </View>
    );
  }

  const personnel = data?.personnelProfile;
  const { assignedTasks, todayAttendance } = data || {};
  const isSecurity = personnel?.category?.toUpperCase() === 'SECURITY';
  const activeTasks = isSecurity ? [] : assignedTasks?.filter((t: any) => t.status !== 'COMPLETED') || [];
  const urgentTasks = activeTasks.filter((task: any) => task.ticket.priority === 'HIGH');
  const firstName = personnel?.name?.split(' ')[0] || 'Team member';

  const handleCheckIn = async () => {
    try {
      await api.post('/work/attendance/check-in');
      refetch();
    } catch (e: any) {
      if (e.response?.status === 403 && e.response?.data?.error?.message) {
        showToast({ title: 'Cannot Check In', message: e.response.data.error.message, type: 'error' });
      } else {
        showToast({ title: 'Error', message: 'Request failed', type: 'error' });
      }
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post('/work/attendance/check-out');
      refetch();
    } catch (e: any) {
      if (e.response?.status === 403 && e.response?.data?.error?.message) {
        showToast({ title: 'Cannot Check Out', message: e.response.data.error.message, type: 'error' });
      } else {
        showToast({ title: 'Error', message: 'Request failed', type: 'error' });
      }
    }
  };

  const isCheckedIn = Boolean(todayAttendance?.checkIn && !todayAttendance?.checkOut);

  return (
    <View style={styles.container}>
      <ScreenEntrance animation="fade">
      <View style={[styles.hero, { paddingTop: Math.max(insets.top + 6, 26) }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>REGENCY SALMA · SECURITY</Text>
            <Text style={styles.greeting}>Good day, {firstName}</Text>
            <Text style={styles.subGreeting}>{getPersonnelRoleLabel(personnel)} · {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          </View>
          <Pressable
            style={[styles.logoutBtn, isLoggingOut && { opacity: 0.6 }]}
            onPress={requestLogout}
            disabled={isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: isLoggingOut }}
            hitSlop={8}
          >
            {isLoggingOut ? <ActivityIndicator size="small" color="#EF4444" /> : <Feather name="log-out" size={20} color="#EF4444" />}
          </Pressable>
        </View>
        {!isSecurity && <View style={styles.heroStatus}>
          <View style={styles.liveDot} />
          <Text style={styles.heroStatusText}>{isCheckedIn ? 'On duty now' : 'Shift not started'}</Text>
          <Text style={styles.heroStatusMeta}>{isCheckedIn ? `Since ${new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Check in to begin'}</Text>
        </View>}
        {!isSecurity && <View style={styles.heroMetrics}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{activeTasks.length}</Text>
            <Text style={styles.heroMetricLabel}>Open tasks</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{urgentTasks.length}</Text>
            <Text style={styles.heroMetricLabel}>Priority</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{isCheckedIn ? 'IN' : 'OFF'}</Text>
            <Text style={styles.heroMetricLabel}>Attendance</Text>
          </View>
        </View>}
      </View>
      </ScreenEntrance>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        <ScreenEntrance delay={80}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Your shift</Text>
                <Text style={styles.sectionHint}>Keep your attendance up to date</Text>
              </View>
              <View style={[styles.statusChip, isCheckedIn ? styles.statusChipActive : styles.statusChipIdle]}>
                <Text style={[styles.statusChipText, isCheckedIn ? styles.statusChipTextActive : styles.statusChipTextIdle]}>{isCheckedIn ? 'Active' : 'Not started'}</Text>
              </View>
            </View>
            <View style={styles.attendanceCard}>
            {isCheckedIn ? (
              <View style={styles.attendanceRow}>
                <View style={styles.attendanceCopy}>
                  <View style={styles.attendanceIcon}><Feather name="radio" size={18} color="#166534" /></View>
                  <View>
                  <Text style={styles.attendanceStatus}>Checked In</Text>
                  <Text style={styles.attendanceTime}>
                    {new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  </View>
                </View>
                <Pressable style={styles.buttonSecondary} onPress={handleCheckOut}>
                  <Text style={styles.buttonSecondaryText}>Check Out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.attendanceRow}>
                <View style={styles.attendanceCopy}>
                  <View style={[styles.attendanceIcon, styles.attendanceIconIdle]}><Feather name="clock" size={18} color="#9A6700" /></View>
                  <View>
                  <Text style={styles.attendanceStatus}>Not Checked In</Text>
                  <Text style={styles.attendanceTime}>Start your day</Text>
                  </View>
                </View>
                <Pressable style={styles.buttonPrimary} onPress={handleCheckIn}>
                  <Text style={styles.buttonPrimaryText}>Check In</Text>
                </Pressable>
              </View>
            )}
            </View>
          </View>
        </ScreenEntrance>

        {!isSecurity && <ScreenEntrance delay={140}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Today’s tasks</Text>
              <Text style={styles.sectionHint}>{activeTasks.length ? `${activeTasks.length} assignment${activeTasks.length === 1 ? '' : 's'} need your attention` : 'Nothing waiting on you'}</Text>
            </View>
            <Pressable onPress={() => router.push('/work/tasks')} hitSlop={8} style={styles.textButton}>
              <Text style={styles.textButtonText}>View all</Text>
              <Feather name="arrow-right" size={15} color={theme.colors.primary} />
            </Pressable>
          </View>
          {activeTasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Feather name="check-circle" size={22} color="#166534" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>All clear for now</Text>
                <Text style={styles.emptyCopy}>New assignments will appear here.</Text>
              </View>
            </View>
          ) : (
            activeTasks.slice(0, 3).map((task: any) => (
              <Pressable
                key={task.id}
                style={styles.taskCard}
                onPress={() => router.push(`/work/tasks/${task.id}` as any)}
              >
                <View style={[styles.taskAccent, task.ticket.priority === 'HIGH' && styles.taskAccentUrgent]} />
                <View style={styles.taskHeader}>
                  <View style={styles.taskTitleRow}>
                    <Feather name="tool" size={18} color={theme.colors.primary} />
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.ticket.title}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: task.ticket.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: task.ticket.priority === 'HIGH' ? '#991B1B' : '#92400E' }]}>
                      {task.ticket.priority}
                    </Text>
                  </View>
                </View>
                <View style={styles.taskMetaRow}>
                  <Text style={styles.taskLocation}><Feather name="map-pin" size={13} color="#6B7280" /> Unit {task.ticket.unitNumber}</Text>
                  <Text style={styles.taskStatus}>{task.status.replace('_', ' ')}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
        </ScreenEntrance>}

        {/* Operations */}
        <ScreenEntrance delay={200}>
        <View style={styles.operationsGrid}>
        <Pressable style={styles.historyCard} onPress={() => router.push('/work/visitors')}>
          <View style={styles.historyIcon}>
            <Feather name="shield" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Gate Operations</Text>
            <Text style={styles.historyDesc}>Check in/out visitors, handle deliveries</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>

                {/* Gate Activity Log */}
        <Pressable style={styles.historyCard} onPress={() => router.push('/work/gate-activity')}>
          <View style={styles.historyIcon}>
            <Feather name="list" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Gate Activity</Text>
            <Text style={styles.historyDesc}>View all recent gate operations & logs</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>

        {/* Task History Link */}
        {!isSecurity && <Pressable style={styles.historyCard} onPress={() => router.push('/work/tasks/history')}>
          <View style={styles.historyIcon}>
            <Feather name="clock" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Task History</Text>
            <Text style={styles.historyDesc}>View all tasks you have completed</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>}
        </View>
        </ScreenEntrance>
      </ScrollView>
      <ConfirmationModal
        visible={isLogoutConfirmVisible}
        onClose={() => setIsLogoutConfirmVisible(false)}
        onConfirm={handleLogout}
        title="Logout?"
        message="Are you sure you want to log out?"
        confirmLabel="Logout"
        variant="danger"
        confirmIcon="log-out"
        loading={isLoggingOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F3',
  },
  hero: {
    backgroundColor: '#143D2A',
    paddingHorizontal: cardSystem.pagePadding,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.7,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B9D7C2',
    marginBottom: 8,
  },
  subGreeting: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C6D9CC',
    marginTop: 4,
  },
  heroStatus: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 22, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.10)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A7F3D0', marginRight: 8 },
  heroStatusText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  heroStatusMeta: { color: '#B9D7C2', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, marginLeft: 8 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  heroMetric: { flex: 1 },
  heroMetricValue: { color: '#FFFFFF', fontSize: 24, lineHeight: 28, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -0.4 },
  heroMetricLabel: { color: '#B9D7C2', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 4 },
  heroMetricDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 12 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 24,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#14251C',
    letterSpacing: -0.3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionHint: { color: '#6B7C70', fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 4 },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingLeft: 8 },
  textButtonText: { color: theme.colors.primary, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusChipActive: { backgroundColor: '#DDF6E7' },
  statusChipIdle: { backgroundColor: '#FFF2CC' },
  statusChipText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold' },
  statusChipTextActive: { color: '#166534' },
  statusChipTextIdle: { color: '#8A5A00' },
  attendanceCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E1E9E2', shadowColor: '#143D2A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  attendanceCopy: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attendanceIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7' },
  attendanceIconIdle: { backgroundColor: '#FFF3CD' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E1E9E2' },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#14251C', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  emptyCopy: { color: '#6B7C70', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 3 },
  availabilityCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  availOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  availOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  availOptionText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#374151',
  },
  availOptionTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceStatus: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#14251C',
  },
  attendanceTime: {
    fontSize: 13,
    color: '#6B7C70',
    marginTop: 2,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  buttonSecondary: {
    backgroundColor: '#F3F4F6',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: 'center',
  },
  buttonSecondaryText: {
    color: '#374151',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E9E2',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  taskAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#78B98B' },
  taskAccentUrgent: { backgroundColor: '#D27D67' },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  taskMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#14251C',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  taskLocation: {
    fontSize: 13,
    color: '#6B7C70',
    marginBottom: 8,
  },
  taskStatus: {
    fontSize: 12,
    color: '#6B7C70',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E9E2',
    gap: 14,
    minHeight: 80,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  operationsGrid: { flexDirection: 'column', gap: 12, marginBottom: 14 },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#E4F2E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#14251C',
    marginBottom: 2,
  },
  historyDesc: {
    fontSize: 12.5,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});
