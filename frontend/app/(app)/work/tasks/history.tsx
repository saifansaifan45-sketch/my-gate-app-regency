import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../../../src/components/ui/Text';
import { theme } from '../../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../src/api/client';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { Ionicons } from '@expo/vector-icons';

export default function WorkTaskHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['workforce-task-history'],
    queryFn: async () => {
      const res = await api.get('/work/tasks/history');
      return res.data;
    },
  });

  const history = data?.history || [];

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => smartBack(router, '/work')} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Task History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No completed tasks yet.</Text>
            <Text style={styles.emptySub}>Tasks you complete will appear here.</Text>
          </View>
        ) : (
          history.map((task: any) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle} numberOfLines={1}>{task.ticket.title}</Text>
                <View style={[styles.badge, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.badgeText}>Done</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>Unit {task.ticket.unitNumber}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="flag-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{task.ticket.priority}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{formatDate(task.completedAt)}</Text>
                </View>
              </View>

              {task.remarks ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Notes: </Text>
                  <Text style={styles.notesText} numberOfLines={2}>{task.remarks}</Text>
                </View>
              ) : null}
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    fontFamily: 'PlusJakartaSans_400Regular',
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
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#059669',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12.5,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  notesLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});