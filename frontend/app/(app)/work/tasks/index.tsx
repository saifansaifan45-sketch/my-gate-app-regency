import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../../../src/components/ui/Text';
import { theme } from '../../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../src/api/client';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSession } from '../../../../src/store/auth';

export default function WorkTasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasWorkforceAccess } = useSession();

  const { data, isLoading, isRefetching, refetch, isError } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
    enabled: hasWorkforceAccess(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  const tasks = data?.assignedTasks || [];
  const activeTasks = tasks.filter((task: any) => task.status !== 'COMPLETED');
  const urgentTasks = activeTasks.filter((task: any) => task.ticket.priority === 'HIGH');
  const isSecurity = data?.personnelProfile?.category?.toUpperCase() === 'SECURITY';

  React.useEffect(() => {
    if (isSecurity) router.replace('/work/visitors');
  }, [isSecurity, router]);

  if (isSecurity) return <View style={styles.container} />;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 6, 26) }]}>
      <View style={styles.header}>
        <View style={styles.responsiveInner}>
          <View style={styles.headerInner}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kicker}>FIELD WORK QUEUE</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>My tasks</Text>
              <Text style={styles.headerSubtitle}>{activeTasks.length ? `${activeTasks.length} open assignment${activeTasks.length === 1 ? '' : 's'}` : 'Your queue is clear'}</Text>
            </View>
            <Pressable style={styles.historyBtn} onPress={() => router.push('/work/tasks/history')} hitSlop={8}>
              <Feather name="clock" size={17} color={theme.colors.primary} />
              <Text style={styles.historyBtnText}>History</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.responsiveInner}>
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{activeTasks.length}</Text><Text style={styles.summaryLabel}>Open</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{urgentTasks.length}</Text><Text style={styles.summaryLabel}>Priority</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{tasks.length - activeTasks.length}</Text><Text style={styles.summaryLabel}>Done</Text></View>
        </View>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={theme.colors.primary} />}
      >
        <View style={styles.responsiveInner}>
        {isError ? (
          <View style={styles.emptyState}>
            <Feather name="cloud-off" size={42} color="#A15C4B" />
            <Text style={styles.emptyText}>Tasks could not load</Text>
            <Pressable onPress={() => refetch()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>All clear for today</Text>
            <Text style={styles.emptySubtext}>New assignments will appear here when they are sent to you.</Text>
          </View>
        ) : (
          tasks.map((task: any) => (
            <Pressable
              key={task.id}
              style={styles.taskCard}
              onPress={() => router.push(`/work/tasks/${task.id}`)}
            >
              <View style={[styles.priorityRail, task.ticket.priority === 'HIGH' && styles.priorityRailHigh]} />
              <View style={styles.taskHeader}>
                <View style={styles.titleLine}>
                  <View style={styles.taskIcon}><Feather name="tool" size={17} color={theme.colors.primary} /></View>
                  <Text style={styles.taskTitle}>{task.ticket.title}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: task.ticket.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7' }]}>
                  <Text style={[styles.badgeText, { color: task.ticket.priority === 'HIGH' ? '#991B1B' : '#92400E' }]}>
                    {task.ticket.priority}
                  </Text>
                </View>
              </View>
              <View style={styles.taskMeta}>
                <Text style={styles.taskLocation}><Feather name="map-pin" size={14} color="#6B7C70" /> Unit {task.ticket.unitNumber}</Text>
                <Text style={[styles.taskStatus, task.status === 'COMPLETED' && styles.taskStatusDone]}>{task.status.replace('_', ' ')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#A2B0A5" style={styles.chevron} />
            </Pressable>
          ))
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F3',
  },
  responsiveInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: '#143D2A',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { fontSize: 10, letterSpacing: 1.2, color: '#B9D7C2', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 7 },
  headerSubtitle: { color: '#C6D9CC', fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 5 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F2E7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 98,
  },
  historyBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.primary,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.7,
  },
  summaryStrip: { marginHorizontal: 24, marginTop: -1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, borderColor: '#E1E9E2', shadowColor: '#143D2A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  summaryItem: { alignItems: 'center', minWidth: 62 },
  summaryValue: { color: '#143D2A', fontSize: 21, fontFamily: 'PlusJakartaSans_700Bold' },
  summaryLabel: { color: '#6B7C70', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 3 },
  summaryDivider: { width: 1, height: 28, backgroundColor: '#E1E9E2' },
  content: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptySubtext: { color: '#6B7C70', fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 8, maxWidth: 270, lineHeight: 19 },
  retryButton: { marginTop: 16, backgroundColor: '#E4F2E7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#143D2A', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
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
  priorityRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#78B98B' },
  priorityRailHigh: { backgroundColor: '#D27D67' },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#14251C',
    flex: 1,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  taskIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#E4F2E7', alignItems: 'center', justifyContent: 'center' },
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
    fontSize: 14,
    color: '#6B7C70',
  },
  taskMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#EEF2EE' },
  taskStatus: {
    fontSize: 12,
    color: '#6B7C70',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  taskStatusDone: { color: '#166534' },
  chevron: { position: 'absolute', right: 14, bottom: 16 },
});
