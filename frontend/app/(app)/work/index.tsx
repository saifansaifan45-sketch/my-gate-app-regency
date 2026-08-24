import React from 'react';
import { Alert } from 'react-native';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { theme } from '../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/api/client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../../src/store/auth';
import { useToast } from '../../../src/store/toast';
import { cardSystem } from '../../../src/components/ui/cardSystem';
import { getPersonnelRoleLabel } from '../../../src/utils/personnel';

export default function WorkforceDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useSession();
  const { showToast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const confirmLogout = () => {
    if (isLoggingOut) return;
    Alert.alert('Log out?', 'You will need to sign in again to access staff operations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
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
        <Ionicons name="time-outline" size={64} color="#D1D5DB" />
        <Text style={{ marginTop: 16, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#111827' }}>Awaiting Approval</Text>
        <Text style={{ marginTop: 8, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
          Your workforce application is currently pending Manager approval.
        </Text>
        <Pressable
          onPress={confirmLogout}
          disabled={isLoggingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          accessibilityState={{ disabled: isLoggingOut }}
          style={{ marginTop: 24, backgroundColor: '#F3F4F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#374151' }}>{isLoggingOut ? 'Logging out…' : 'Log out'}</Text>
        </Pressable>
      </View>
    );
  }

  const personnel = data?.personnelProfile;
  const { assignedTasks, todayAttendance } = data || {};
  const activeTasks = assignedTasks?.filter((t: any) => t.status !== 'COMPLETED') || [];

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

  const isCheckedIn = todayAttendance?.checkIn && !todayAttendance?.checkOut;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {personnel?.name?.split(' ')[0] || 'Team Member'}
            </Text>
            <Text style={styles.subGreeting}>{getPersonnelRoleLabel(personnel)}</Text>
          </View>
          <Pressable
            style={[styles.logoutBtn, isLoggingOut && { opacity: 0.6 }]}
            onPress={confirmLogout}
            disabled={isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: isLoggingOut }}
            hitSlop={8}
          >
            {isLoggingOut ? <ActivityIndicator size="small" color="#374151" /> : <Ionicons name="log-out-outline" size={20} color="#374151" />}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {/* Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.card}>
            {isCheckedIn ? (
              <View style={styles.attendanceRow}>
                <View>
                  <Text style={styles.attendanceStatus}>Checked In</Text>
                  <Text style={styles.attendanceTime}>
                    {new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Pressable style={styles.buttonSecondary} onPress={handleCheckOut}>
                  <Text style={styles.buttonSecondaryText}>Check Out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.attendanceRow}>
                <View>
                  <Text style={styles.attendanceStatus}>Not Checked In</Text>
                  <Text style={styles.attendanceTime}>Start your day</Text>
                </View>
                <Pressable style={styles.buttonPrimary} onPress={handleCheckIn}>
                  <Text style={styles.buttonPrimaryText}>Check In</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Today's Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          {activeTasks.length === 0 ? (
            <View style={styles.card}>
              <Text style={{ color: '#6B7280' }}>No tasks assigned for today.</Text>
            </View>
          ) : (
            activeTasks.map((task: any) => (
              <Pressable
                key={task.id}
                style={styles.taskCard}
                onPress={() => router.push(`/work/tasks/${task.id}` as any)}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle} numberOfLines={1}>{task.ticket.title}</Text>
                  <View style={[styles.badge, { backgroundColor: task.ticket.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: task.ticket.priority === 'HIGH' ? '#991B1B' : '#92400E' }]}>
                      {task.ticket.priority}
                    </Text>
                  </View>
                </View>
                <Text style={styles.taskLocation}>Unit {task.ticket.unitNumber}</Text>
                <Text style={styles.taskStatus}>{task.status.replace('_', ' ')}</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Gate Operations */}
        <Pressable style={styles.historyCard} onPress={() => router.push('/work/visitors')}>
          <View style={styles.historyIcon}>
            <Ionicons name="shield-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Gate Operations</Text>
            <Text style={styles.historyDesc}>Check in/out visitors, handle deliveries</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

                {/* Gate Activity Log */}
        <Pressable style={styles.historyCard} onPress={() => router.push('/work/gate-activity')}>
          <View style={styles.historyIcon}>
            <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Gate Activity</Text>
            <Text style={styles.historyDesc}>View all recent gate operations & logs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        {/* Task History Link */}
        <Pressable style={styles.historyCard} onPress={() => router.push('/work/tasks/history')}>
          <View style={styles.historyIcon}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Task History</Text>
            <Text style={styles.historyDesc}>View all tasks you have completed</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
    marginTop: 4,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#374151',
    marginBottom: 12,
  },
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
    color: '#111827',
  },
  attendanceTime: {
    fontSize: 13,
    color: '#6B7280',
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111827',
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
    color: '#4B5563',
    marginBottom: 8,
  },
  taskStatus: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 2,
  },
  historyDesc: {
    fontSize: 12.5,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});
