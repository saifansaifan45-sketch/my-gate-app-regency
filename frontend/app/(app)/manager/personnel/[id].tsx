import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../../src/components/ui/Text';
import { PremiumPressable } from '../../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../src/theme';
import { managerApi, AvailabilityStatus } from '../../../../src/api/manager';
import { cardSystem } from '../../../../src/components/ui/cardSystem';

const STATUS_OPTIONS: { id: AvailabilityStatus; label: string; bg: string; color: string }[] = [
  { id: 'AVAILABLE', label: 'Available', bg: '#ECFDF5', color: '#059669' },
  { id: 'BUSY', label: 'Busy', bg: '#FEF3C7', color: '#D97706' },
  { id: 'OFF_DUTY', label: 'Off Duty', bg: '#F3F4F6', color: '#6B7280' },
  { id: 'LEAVE', label: 'On Leave', bg: '#FEE2E2', color: '#DC2626' },
];

export default function PersonnelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);

  const [personnel, setPersonnel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await managerApi.getPersonnelDetail(id);
      setPersonnel(data);
    } catch (err) {
      console.warn('Failed to load personnel detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStatusChange = async (newStatus: AvailabilityStatus) => {
    if (!id) return;
    setStatusUpdating(true);
    try {
      const updated = await managerApi.updatePersonnel(id, { availabilityStatus: newStatus });
      setPersonnel((prev: any) => ({ ...prev, availabilityStatus: updated.availabilityStatus }));
      Alert.alert('Status Updated', `${personnel.name} is now set to ${newStatus.replace('_', ' ')}.`);
    } catch {
      Alert.alert('Error', 'Failed to update availability status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleEmploymentStatusChange = async (newStatus: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED') => {
    if (!id) return;
    setStatusUpdating(true);
    try {
      await managerApi.updatePersonnelStatus(id, { employmentStatus: newStatus });
      setPersonnel((prev: any) => ({ ...prev, employmentStatus: newStatus }));
      Alert.alert('Status Updated', `Employment status is now set to ${newStatus}.`);
    } catch {
      Alert.alert('Error', 'Failed to update employment status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const confirmSuspend = () => {
    Alert.alert(
      'Suspend Staff Member',
      `Are you sure you want to suspend ${personnel?.name || 'this staff member'}? They will no longer receive task dispatches.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Suspend', style: 'destructive', onPress: () => handleEmploymentStatusChange('SUSPENDED') },
      ]
    );
  };

  const confirmTerminate = () => {
    Alert.alert(
      'Terminate Employment',
      `Are you sure you want to terminate employment for ${personnel?.name || 'this staff member'}? All operational access will be permanently revoked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Terminate', style: 'destructive', onPress: () => handleEmploymentStatusChange('TERMINATED') },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader
        variant="subscreen"
        title="Personnel Details"
        onBackPress={() => smartBack(router, '/manager/personnel')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading || !personnel ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={100} borderRadius={20} />
            <Skeleton height={180} borderRadius={20} />
          </View>
        ) : (
          <>
            {/* Personnel Profile Card */}
            <ScreenEntrance delay={50}>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Feather name="user" size={28} color={theme.colors.primary} />
                </View>

                <Text style={styles.name}>{personnel.name}</Text>
                <Text style={styles.categoryBadge}>{personnel.category}</Text>
                <Text style={styles.phone}>{personnel.phone}</Text>

                {/* Quick Call Action */}
                <View style={styles.contactRow}>
                  <PremiumPressable
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`tel:${personnel.phone}`)}
                  >
                    <Feather name="phone" size={16} color={theme.colors.primary} />
                    <Text style={styles.contactBtnText}>Call Staff</Text>
                  </PremiumPressable>
                  <PremiumPressable
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`sms:${personnel.phone}`)}
                  >
                    <Feather name="message-square" size={16} color={theme.colors.primary} />
                    <Text style={styles.contactBtnText}>Send SMS</Text>
                  </PremiumPressable>
                </View>
              </View>
            </ScreenEntrance>

            {/* Availability Status Selector */}
            <ScreenEntrance delay={100}>
              <Text style={styles.sectionTitle}>Availability Status</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = personnel.availabilityStatus === opt.id;
                  return (
                    <PremiumPressable
                      key={opt.id}
                      style={[
                        styles.statusCard,
                        isSelected && { borderColor: opt.color, backgroundColor: opt.bg },
                      ]}
                      onPress={() => handleStatusChange(opt.id)}
                      disabled={statusUpdating}
                    >
                      <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                      <Text style={[styles.statusOptionLabel, isSelected && { color: opt.color }]}>
                        {opt.label}
                      </Text>
                    </PremiumPressable>
                  );
                })}
              </View>
            </ScreenEntrance>

            {/* Tasks History */}
            <ScreenEntrance delay={150}>
              <Text style={styles.sectionTitle}>Assigned Work & History ({personnel.tasks?.length || 0})</Text>
              {personnel.tasks && personnel.tasks.length > 0 ? (
                personnel.tasks.map((task: any) => (
                  <PremiumPressable
                    key={task.id}
                    style={styles.taskCard}
                    onPress={() => router.push(`/manager/tickets/${task.ticket?.id}` as any)}
                  >
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskTitle}>{task.ticket?.title || 'Maintenance Task'}</Text>
                      <View style={styles.taskStatusPill}>
                        <Text style={styles.taskStatusText}>{task.status.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={styles.taskSub}>
                      Unit {task.ticket?.resident?.unitNumber || '9A'} · {task.ticket?.resident?.firstName}
                    </Text>
                    {task.remarks ? <Text style={styles.taskRemarks}>{task.remarks}</Text> : null}
                  </PremiumPressable>
                ))
              ) : (
                <EmptyState
                  icon="tool"
                  title="No assigned tasks"
                  description="This staff member has no current or past tasks."
                />
              )}
            </ScreenEntrance>

            {/* Recent Attendance Records */}
            <ScreenEntrance delay={200}>
              <Text style={styles.sectionTitle}>Recent Attendance Log</Text>
              <View style={styles.attendanceCard}>
                {personnel.attendances && personnel.attendances.length > 0 ? (
                  personnel.attendances.map((att: any, idx: number) => (
                    <View
                      key={att.id}
                      style={[
                        styles.attRow,
                        idx === personnel.attendances.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View>
                        <Text style={styles.attDate}>
                          {new Date(att.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.attRemarks}>{att.remarks || 'Regular shift'}</Text>
                      </View>
                      <View
                        style={[
                          styles.attBadge,
                          att.status === 'PRESENT' && { backgroundColor: '#ECFDF5' },
                          att.status === 'ABSENT' && { backgroundColor: '#F3F4F6' },
                          att.status === 'LEAVE' && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attBadgeText,
                            att.status === 'PRESENT' && { color: '#047857' },
                            att.status === 'ABSENT' && { color: '#6B7280' },
                            att.status === 'LEAVE' && { color: '#DC2626' },
                          ]}
                        >
                          {att.status}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noAttText}>No attendance records recorded yet.</Text>
                )}
              </View>
            </ScreenEntrance>

            {/* Employment Status & Safety Actions */}
            <ScreenEntrance delay={230}>
              <Text style={styles.sectionTitle}>Account Status & Safety Controls</Text>
              <View style={styles.dangerCard}>
                <View style={styles.statusInfoRow}>
                  <Text style={styles.statusInfoLabel}>Employment Status:</Text>
                  <View
                    style={[
                      styles.empBadge,
                      personnel.employmentStatus === 'ACTIVE' && { backgroundColor: '#ECFDF5' },
                      personnel.employmentStatus === 'SUSPENDED' && { backgroundColor: '#FEF3C7' },
                      personnel.employmentStatus === 'TERMINATED' && { backgroundColor: '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.empBadgeText,
                        personnel.employmentStatus === 'ACTIVE' && { color: '#047857' },
                        personnel.employmentStatus === 'SUSPENDED' && { color: '#B45309' },
                        personnel.employmentStatus === 'TERMINATED' && { color: '#DC2626' },
                      ]}
                    >
                      {personnel.employmentStatus || 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                <View style={styles.dangerActionsRow}>
                  {personnel.employmentStatus === 'SUSPENDED' ? (
                    <PremiumPressable
                      style={[styles.dangerBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                      onPress={() => handleEmploymentStatusChange('ACTIVE')}
                      disabled={statusUpdating}
                    >
                      <Feather name="check-circle" size={15} color="#047857" />
                      <Text style={[styles.dangerBtnText, { color: '#047857' }]}>Reactivate Staff Profile</Text>
                    </PremiumPressable>
                  ) : personnel.employmentStatus !== 'TERMINATED' ? (
                    <PremiumPressable
                      style={[styles.dangerBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                      onPress={() => confirmSuspend()}
                      disabled={statusUpdating}
                    >
                      <Feather name="pause-circle" size={15} color="#B45309" />
                      <Text style={[styles.dangerBtnText, { color: '#B45309' }]}>Suspend Profile</Text>
                    </PremiumPressable>
                  ) : null}

                  {personnel.employmentStatus !== 'TERMINATED' && (
                    <PremiumPressable
                      style={[styles.dangerBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={() => confirmTerminate()}
                      disabled={statusUpdating}
                    >
                      <Feather name="user-x" size={15} color="#DC2626" />
                      <Text style={[styles.dangerBtnText, { color: '#DC2626' }]}>Terminate Employment</Text>
                    </PremiumPressable>
                  )}
                </View>
              </View>
            </ScreenEntrance>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 10 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  categoryBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 98,
    marginBottom: 6,
  },
  phone: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  contactRow: { flexDirection: 'row', gap: 12, width: '100%' },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contactBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    marginLeft: 4,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statusCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusDot: { width: 10, height: 10, borderRadius: 3 },
  statusOptionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  taskStatusPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  taskStatusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#1D4ED8',
  },
  taskSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  taskRemarks: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  attendanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 20,
  },
  attRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  attDate: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  attRemarks: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  attBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  attBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  noAttText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    paddingVertical: 14,
    textAlign: 'center',
  },
  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  statusInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusInfoLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  empBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  empBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.5,
  },
  dangerActionsRow: {
    gap: 10,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dangerBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
});
