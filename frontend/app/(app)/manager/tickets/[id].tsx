import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Modal, TextInput, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../../src/components/ui/Text';
import { PremiumPressable } from '../../../../src/components/ui/PremiumPressable';
import { Button } from '../../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../src/theme';
import { api } from '../../../../src/api/client';
import { managerApi, TicketItem, TaskStatus, TicketPriority } from '../../../../src/api/manager';
import { useToast } from '../../../../src/store/toast';
import { homeDashboardQueryKey } from '../../../../src/api/home-dashboard';
import { cardSystem } from '../../../../src/components/ui/cardSystem';

const WORKFLOW_STEPS = [
  { key: 'CREATED', label: 'Created' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Work completed' },
  { key: 'RESIDENT_REVIEW', label: 'Resident review' },
  { key: 'CLOSED', label: 'Closed' },
];

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const ticketId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<TicketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'not-found' | 'generic' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Remarks Modal
  const [remarksModalVisible, setRemarksModalVisible] = useState(false);
  const [managerRemarks, setManagerRemarks] = useState('');

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      setLoadError('not-found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await managerApi.getTicket(ticketId);
      setTicket(data);
      setManagerRemarks(data.remarks || '');
    } catch (err) {
      console.warn('Failed to load ticket:', err);
      setTicket(null);
      const status = (err as { response?: { status?: number } })?.response?.status;
      setLoadError(status === 404 ? 'not-found' : 'generic');
      showToast({
        title: status === 404 ? 'Ticket unavailable' : 'Unable to load ticket',
        message: status === 404 ? 'This request may have been removed or is no longer accessible.' : 'Check your connection and try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [ticketId, showToast]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Tasks are kept as a history. Prefer the newest non-cancelled assignment
  // with its personnel relation present instead of assuming tasks[0] is the
  // current assignment.
  const activeTask =
    ticket?.tasks?.find((task) => task.status !== 'CANCELLED' && task.assignedPersonnel) ??
    ticket?.tasks?.find((task) => task.status !== 'CANCELLED');

  const getStepIndex = () => {
    if (!ticket) return 0;
    switch (ticket.status) {
      case 'OPEN':
        return 0;
      case 'ASSIGNED':
        return 1;
      case 'IN_PROGRESS':
        return 2;
      case 'COMPLETED_BY_WORKER':
        return 3;
      case 'PENDING_RESIDENT_CONFIRMATION':
        return 4;
      case 'CLOSED':
        return 5;
      case 'REOPENED':
        return 1;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex();

  const handleAcceptTicket = async () => {
    if (!ticketId) return;
    setActionLoading(true);
    try {
      const updated = await managerApi.updateTicket(ticketId, { status: 'ASSIGNED' });
      setTicket(updated);
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      showToast({
        title: 'Request Assigned',
        message: 'The ticket has been updated.',
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Action Failed',
        message: 'Failed to update ticket.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (newStatus: TaskStatus) => {
    if (!activeTask) return;
    setActionLoading(true);
    try {
      await managerApi.updateTask(activeTask.id, { status: newStatus });
      await fetchTicket();
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      if (newStatus === 'COMPLETED') {
        showToast({
          title: 'Work Completed',
          message: 'The ticket is now awaiting manager and resident confirmation.',
          type: 'success',
        });
      } else {
        showToast({
          title: 'Workflow Updated',
          message: `Task is now marked as ${newStatus.replace('_', ' ').toLowerCase()}.`,
          type: 'info',
        });
      }
    } catch {
      showToast({
        title: 'Error',
        message: 'Could not update task status.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveCompletion = async () => {
    if (!ticketId) return;
    setActionLoading(true);
    try {
      await api.post(`/manager/tickets/${ticketId}/approve-work-completion`);
      await fetchTicket();
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      showToast({
        title: 'Completion Approved',
        message: 'Resident has been notified to verify the resolution.',
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Error',
        message: 'Could not approve work completion.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!ticketId) return;
    try {
      const updated = await managerApi.updateTicket(ticketId, { remarks: managerRemarks.trim() });
      setTicket(updated);
      setRemarksModalVisible(false);
      showToast({
        title: 'Remarks Saved',
        message: 'Manager remarks updated successfully.',
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Save Failed',
        message: 'Failed to save remarks.',
        type: 'error',
      });
    }
  };

  const handleChangePriority = async (priority: TicketPriority) => {
    if (!ticketId) return;
    try {
      const updated = await managerApi.updateTicket(ticketId, { priority });
      setTicket(updated);
      showToast({
        title: 'Priority Updated',
        message: `Ticket priority set to ${priority}.`,
        type: 'info',
      });
    } catch {
      showToast({
        title: 'Update Failed',
        message: 'Failed to update priority.',
        type: 'error',
      });
    }
  };

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title={`Ticket #${ticketId ? ticketId.slice(0, 6).toUpperCase() : ''}`}
        onBackPress={() => smartBack(router, '/manager/tickets')}
        rightAction={ticket ? (
          <PremiumPressable
            onPress={() => setRemarksModalVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="edit-3" size={18} color={theme.colors.textPrimary} />
          </PremiumPressable>
        ) : undefined}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={120} borderRadius={20} />
            <Skeleton height={200} borderRadius={20} />
          </View>
        ) : loadError ? (
          <View style={styles.errorState}>
            <View style={styles.errorIcon}>
              <Feather name={loadError === 'not-found' ? 'file-minus' : 'wifi-off'} size={24} color="#B45309" />
            </View>
            <Text style={styles.errorTitle}>
              {loadError === 'not-found' ? 'Ticket unavailable' : 'Ticket could not be loaded'}
            </Text>
            <Text style={styles.errorDescription}>
              {loadError === 'not-found'
                ? 'This request may have been removed, expired, or is no longer available to your community.'
                : 'Check your connection and try again.'}
            </Text>
            <View style={styles.errorActions}>
              <PremiumPressable style={styles.errorSecondaryButton} onPress={() => router.replace('/manager/tickets')}>
                <Text style={styles.errorSecondaryText}>Back to tickets</Text>
              </PremiumPressable>
              <PremiumPressable style={styles.errorPrimaryButton} onPress={fetchTicket}>
                <Text style={styles.errorPrimaryText}>Try again</Text>
              </PremiumPressable>
            </View>
          </View>
        ) : !ticket ? (
          <View style={styles.errorState}>
            <Text style={styles.errorTitle}>Ticket unavailable</Text>
            <Text style={styles.errorDescription}>We could not find this request.</Text>
          </View>
        ) : (
          <>
            {/* Workflow Progression Stepper */}
            <ScreenEntrance delay={50}>
              <View style={styles.stepperCard}>
                <Text style={styles.stepperTitle}>Resolution Workflow</Text>
                <View style={styles.stepperTrack}>
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const isDone = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <View key={step.key} style={styles.stepCol}>
                        <View style={[styles.stepDot, isDone && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                          {isDone ? (
                            <Feather name="check" size={10} color="#FFFFFF" />
                          ) : (
                            <View style={styles.stepDotInner} />
                          )}
                        </View>
                        <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent, isDone && styles.stepLabelDone]}>
                          {step.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScreenEntrance>

            {/* Ticket Overview Card */}
            <ScreenEntrance delay={100}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{ticket.category}</Text>
                  </View>
                  <View style={styles.priorityRow}>
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TicketPriority[]).map((p) => {
                      const selected = ticket.priority === p;
                      return (
                        <PremiumPressable
                          key={p}
                          style={[styles.priorityOption, selected && styles.priorityOptionSelected]}
                          onPress={() => handleChangePriority(p)}
                        >
                          <Text style={[styles.priorityOptionText, selected && styles.priorityOptionTextSelected]}>
                            {p}
                          </Text>
                        </PremiumPressable>
                      );
                    })}
                  </View>
                </View>

                <Text style={styles.title}>{ticket.title}</Text>
                <Text style={styles.description}>{ticket.description}</Text>

                {ticket.remarks ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>Manager Remarks:</Text>
                    <Text style={styles.remarksText}>{ticket.remarks}</Text>
                  </View>
                ) : null}

                <View style={styles.timeRow}>
                  <Feather name="clock" size={13} color={theme.colors.textSecondary} />
                  <Text style={styles.timeText}>
                    Reported on {new Date(ticket.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                </View>
              </View>
            </ScreenEntrance>

            {/* Resident Information */}
            <ScreenEntrance delay={150}>
              <Text style={styles.sectionHeader}>Resident Details</Text>
              <View style={styles.residentCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {ticket.resident?.firstName?.charAt(0) || 'R'}
                  </Text>
                </View>
                <View style={styles.residentInfo}>
                  <Text style={styles.residentName}>
                    {ticket.resident?.firstName} {ticket.resident?.lastName || ''}
                  </Text>
                  <Text style={styles.residentUnit}>Unit {ticket.resident?.unitNumber || '9A'} · Regency Salma</Text>
                  <Text style={styles.residentContact}>{ticket.resident?.phoneNumber || '+91 98765 00000'}</Text>
                </View>
                <PremiumPressable
                  style={styles.callBtn}
                  onPress={() => handleCall(ticket.resident?.phoneNumber || undefined)}
                >
                  <Feather name="phone" size={18} color={theme.colors.primary} />
                </PremiumPressable>
              </View>
            </ScreenEntrance>

            {/* Assigned Personnel Section */}
            <ScreenEntrance delay={200}>
              <Text style={styles.sectionHeader}>Assigned Maintenance Personnel</Text>
              {activeTask ? (
                <View style={styles.personnelCard}>
                  <View style={styles.personnelTop}>
                    <View style={styles.personnelIconWrap}>
                      <Feather name="tool" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.personnelInfo}>
                      <Text style={styles.personnelName}>{activeTask.assignedPersonnel?.name || 'Assigned Staff'}</Text>
                      <Text style={styles.personnelCategory}>
                        {activeTask.assignedPersonnel?.category || 'Staff'} · {activeTask.status.replace('_', ' ')}
                      </Text>
                    </View>
                    <PremiumPressable
                      style={styles.callBtnSmall}
                      onPress={() => handleCall(activeTask.assignedPersonnel?.phone)}
                    >
                      <Feather name="phone-call" size={16} color={theme.colors.primary} />
                    </PremiumPressable>
                  </View>

                  <View style={styles.taskTimelineBox}>
                    <View style={styles.taskMetaRow}>
                      <Text style={styles.taskMetaLabel}>Assigned by:</Text>
                      <Text style={styles.taskMetaVal}>{activeTask.assignedBy?.firstName || 'Manager'}</Text>
                    </View>
                    {activeTask.startedAt && (
                      <View style={styles.taskMetaRow}>
                        <Text style={styles.taskMetaLabel}>Started at:</Text>
                        <Text style={styles.taskMetaVal}>
                          {new Date(activeTask.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    {activeTask.completedAt && (
                      <View style={styles.taskMetaRow}>
                        <Text style={styles.taskMetaLabel}>Completed at:</Text>
                        <Text style={styles.taskMetaVal}>
                          {new Date(activeTask.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    {activeTask.remarks && (
                      <View style={styles.taskMetaRow}>
                        <Text style={styles.taskMetaLabel}>Staff Note:</Text>
                        <Text style={styles.taskMetaVal}>{activeTask.remarks}</Text>
                      </View>
                    )}
                  </View>

                  {/* Progressive Task Action Simulation */}
                  <View style={styles.taskActionRow}>
                    {activeTask.status === 'ASSIGNED' && (
                      <Button
                        label="Start Work (Personnel Active)"
                        variant="secondary"
                        onPress={() => handleUpdateTaskStatus('IN_PROGRESS')}
                        loading={actionLoading}
                      />
                    )}
                    {activeTask.status === 'IN_PROGRESS' && (
                      <Button
                        label="Mark Work Completed"
                        variant="primary"
                        onPress={() => handleUpdateTaskStatus('COMPLETED')}
                        loading={actionLoading}
                      />
                    )}
                    {activeTask.status === 'COMPLETED' && (
                      <Button
                        label="Approve Work Completion"
                        variant="primary"
                        onPress={handleApproveCompletion}
                        loading={actionLoading}
                      />
                    )}
                    {activeTask.status === 'VERIFIED' && (
                      <View style={styles.verifiedBox}>
                        <Feather name="check-circle" size={18} color="#059669" />
                        <Text style={styles.verifiedText}>Awaiting Resident Confirmation</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.unassignedCard}>
                  <Feather name="alert-circle" size={24} color="#D97706" />
                  <Text style={styles.unassignedTitle}>No Personnel Assigned</Text>
                  <Text style={styles.unassignedDesc}>
                    Assign an available technician or maintenance personnel to resolve this ticket.
                  </Text>
                  <Button
                    label="Assign Personnel Now"
                    onPress={() =>
                      router.push({
                        pathname: '/manager/tickets/assign',
                        params: { ticketId: ticket.id, category: ticket.category },
                      } as any)
                    }
                    style={{ marginTop: 12 }}
                  />
                </View>
              )}
            </ScreenEntrance>
          </>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      {ticket && ticket.status === 'OPEN' && !activeTask && (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Button
              label="Accept Request"
              variant="secondary"
              onPress={handleAcceptTicket}
              loading={actionLoading}
            />
          </View>
          <View style={{ flex: 1.2 }}>
            <Button
              label="Assign Personnel"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: '/manager/tickets/assign',
                  params: { ticketId: ticket.id, category: ticket.category },
                } as any)
              }
            />
          </View>
        </View>
      )}

      {/* Remarks Modal */}
      <Modal visible={remarksModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manager Remarks</Text>
            <Text style={styles.modalSubtitle}>Add notes for tracking or resident updates.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Parts ordered, expected completion by 4 PM..."
              placeholderTextColor={theme.colors.textSecondary}
              value={managerRemarks}
              onChangeText={setManagerRemarks}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <PremiumPressable style={styles.modalCancel} onPress={() => setRemarksModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </PremiumPressable>
              <PremiumPressable style={styles.modalSave} onPress={handleSaveRemarks}>
                <Text style={styles.modalSaveText}>Save Remarks</Text>
              </PremiumPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 10 },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 34,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    marginBottom: 14,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 22,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorSecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  errorSecondaryText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  errorPrimaryButton: {
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  errorPrimaryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  stepperTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepCol: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepDotDone: { backgroundColor: theme.colors.primary },
  stepDotCurrent: {
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: '#D1FAE5',
  },
  stepDotInner: { width: 6, height: 6, borderRadius: 1, backgroundColor: '#9CA3AF' },
  stepLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelDone: { color: theme.colors.textPrimary },
  stepLabelCurrent: { fontFamily: 'PlusJakartaSans_700Bold', color: theme.colors.primary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  priorityRow: { flexDirection: 'row', gap: 4 },
  priorityOption: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  priorityOptionSelected: { backgroundColor: '#FEF3C7' },
  priorityOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#6B7280',
  },
  priorityOptionTextSelected: { color: '#B45309', fontFamily: 'PlusJakartaSans_700Bold' },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  remarksBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  remarksLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  remarksText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#143D2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  residentInfo: { flex: 1 },
  residentName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  residentUnit: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  residentContact: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personnelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  personnelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  personnelIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personnelInfo: { flex: 1 },
  personnelName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  personnelCategory: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#0284C7',
  },
  callBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTimelineBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 16,
  },
  taskMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  taskMetaLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  taskMetaVal: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  taskActionRow: { gap: 10 },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
  },
  verifiedText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#047857',
  },
  unassignedCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 20,
  },
  unassignedTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#92400E',
    marginTop: 8,
    marginBottom: 4,
  },
  unassignedDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 19,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  modalSave: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalSaveText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
