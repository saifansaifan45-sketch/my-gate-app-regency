import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '../../../../src/components/ui/Text';
import { theme } from '../../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../src/api/client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WorkTasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  const tasks = data?.assignedTasks || [];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <Pressable style={styles.historyBtn} onPress={() => router.push('/work/tasks/history')} hitSlop={8}>
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.historyBtnText}>History</Text>
        </Pressable>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>All caught up for today!</Text>
          </View>
        ) : (
          tasks.map((task: any) => (
            <Pressable
              key={task.id}
              style={styles.taskCard}
              onPress={() => router.push(`/work/tasks/${task.id}`)}
            >
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle}>{task.ticket.title}</Text>
                <View style={[styles.badge, { backgroundColor: task.ticket.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7' }]}>
                  <Text style={[styles.badgeText, { color: task.ticket.priority === 'HIGH' ? '#991B1B' : '#92400E' }]}>
                    {task.ticket.priority}
                  </Text>
                </View>
              </View>
              <Text style={styles.taskLocation}>📍 {task.ticket.unitNumber}</Text>
              <Text style={styles.taskStatus}>{task.status.replace('_', ' ')}</Text>
            </Pressable>
          ))
        )}
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
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
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  content: {
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
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
    fontSize: 16,
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
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  taskStatus: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
