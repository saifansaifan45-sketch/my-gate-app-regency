import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { managerApi, TicketItem, TaskStatus } from '../../../src/api/manager';
import { cardSystem } from '../../../src/components/ui/cardSystem';

const TASK_TABS = [
  { id: 'ALL', label: 'All Tasks' },
  { id: 'ASSIGNED', label: 'Assigned' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'VERIFIED', label: 'Verified' },
];

export default function ManagerTasksTrackerScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);

  const [activeTab, setActiveTab] = useState('ALL');
  const [ticketsWithTasks, setTicketsWithTasks] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await managerApi.getTickets();
      // Filter tickets that have tasks
      const withTasks = res.tickets.filter((t) => t.tasks && t.tasks.length > 0);
      setTicketsWithTasks(withTasks);
    } catch (err) {
      console.warn('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    setActionLoading(true);
    try {
      await managerApi.updateTask(taskId, { status: newStatus });
      Alert.alert('Status Updated', `Task moved to ${newStatus.replace('_', ' ')}.`);
      fetchTasks();
    } catch {
      Alert.alert('Error', 'Failed to update task status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Flatten tasks with ticket info
  const allTasks = ticketsWithTasks.flatMap((t) =>
    (t.tasks || []).map((tsk) => ({
      ...tsk,
      ticketTitle: t.title,
      ticketCategory: t.category,
      resident: t.resident,
    }))
  );

  const filteredTasks = allTasks.filter((t) => {
    if (activeTab === 'ALL') return true;
    return t.status === activeTab;
  });

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'ASSIGNED':
        return { bg: '#EFF6FF', text: '#1D4ED8', label: 'Assigned' };
      case 'IN_PROGRESS':
        return { bg: '#FEF3C7', text: '#D97706', label: 'In Progress' };
      case 'COMPLETED':
        return { bg: '#ECFDF5', text: '#047857', label: 'Completed' };
      case 'VERIFIED':
        return { bg: '#EDE9FE', text: '#6D28D9', label: 'Verified' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: status };
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Task Status Tracking"
        onBackPress={() => smartBack(router, '/manager')}
      />

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TASK_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <PremiumPressable
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </PremiumPressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={140} borderRadius={18} />
            <Skeleton height={140} borderRadius={18} />
          </View>
        ) : filteredTasks.length > 0 ? (
          filteredTasks.map((task, index) => {
            const statusMeta = getStatusBadge(task.status);

            return (
              <ScreenEntrance key={task.id} delay={60 + index * 40}>
                <View style={styles.taskCard}>
                  <View style={styles.taskTop}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryText}>{task.ticketCategory}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.taskTitle}>{task.ticketTitle}</Text>
                  <Text style={styles.residentSub}>
                    Unit {task.resident?.unitNumber || '9A'} · Resident: {task.resident?.firstName} {task.resident?.lastName || ''}
                  </Text>

                  {/* Staff Info Box */}
                  <View style={styles.staffBox}>
                    <Feather name="tool" size={14} color={theme.colors.primary} />
                    <Text style={styles.staffText}>
                      Assigned to: <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{task.assignedPersonnel?.name}</Text> ({task.assignedPersonnel?.category})
                    </Text>
                  </View>

                  {task.remarks ? (
                    <Text style={styles.remarksText}>Note: {task.remarks}</Text>
                  ) : null}

                  {/* Quick Workflow Action Stepper */}
                  <View style={styles.actionRow}>
                    {task.status === 'ASSIGNED' && (
                      <PremiumPressable
                        style={[styles.workflowBtn, { backgroundColor: '#FEF3C7' }]}
                        onPress={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                        disabled={actionLoading}
                      >
                        <Feather name="play" size={13} color="#B45309" />
                        <Text style={[styles.workflowBtnText, { color: '#B45309' }]}>Start Work</Text>
                      </PremiumPressable>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                      <PremiumPressable
                        style={[styles.workflowBtn, { backgroundColor: '#ECFDF5' }]}
                        onPress={() => handleUpdateStatus(task.id, 'COMPLETED')}
                        disabled={actionLoading}
                      >
                        <Feather name="check" size={13} color="#047857" />
                        <Text style={[styles.workflowBtnText, { color: '#047857' }]}>Complete Work</Text>
                      </PremiumPressable>
                    )}

                    {task.status === 'COMPLETED' && (
                      <PremiumPressable
                        style={[styles.workflowBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={() => handleUpdateStatus(task.id, 'VERIFIED')}
                        disabled={actionLoading}
                      >
                        <Feather name="award" size={13} color="#FFFFFF" />
                        <Text style={[styles.workflowBtnText, { color: '#FFFFFF' }]}>Verify & Close</Text>
                      </PremiumPressable>
                    )}

                    <PremiumPressable
                      style={styles.viewTicketBtn}
                      onPress={() => router.push(`/manager/tickets/${task.ticketId}` as any)}
                    >
                      <Text style={styles.viewTicketText}>View Ticket</Text>
                      <Feather name="chevron-right" size={14} color={theme.colors.textSecondary} />
                    </PremiumPressable>
                  </View>
                </View>
              </ScreenEntrance>
            );
          })
        ) : (
          <EmptyState
            icon="activity"
            title="No tasks in this stage"
            description="Assign personnel from the ticket inbox to start tracking tasks."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: theme.colors.background,
  },
  tabs: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 98,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingTop: 14 },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 98,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  taskTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  residentSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  staffBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  staffText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.primary,
  },
  remarksText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: 12,
    marginTop: 4,
  },
  workflowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 98,
  },
  workflowBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
  },
  viewTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  viewTicketText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
