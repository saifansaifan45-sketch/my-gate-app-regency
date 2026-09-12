import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { ticketsApi } from '../../../src/api/tickets';
import { TicketItem } from '../../../src/api/manager';
import { useToast } from '../../../src/store/toast';
import { useQueryClient } from '@tanstack/react-query';
import { homeDashboardQueryKey } from '../../../src/api/home-dashboard';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function MaintenanceScreen() {
  const router = useRouter();
  const { top, bottom, bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [serverTickets, setServerTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<{ id: string; realId?: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchServerTickets = useCallback(async () => {
    try {
      const res = await ticketsApi.getMyTickets();
      setServerTickets(res.tickets);
    } catch (err) {
      console.warn('Failed to load server tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServerTickets();
  }, [fetchServerTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServerTickets();
  };

  const getCategoryIcon = (category: string): React.ComponentProps<typeof Feather>['name'] => {
    if (category.toLowerCase().includes('plumb')) return 'droplet';
    if (category.toLowerCase().includes('electr')) return 'zap';
    if (category.toLowerCase().includes('lift')) return 'arrow-up';
    if (category.toLowerCase().includes('clean')) return 'trash-2';
    if (category.toLowerCase().includes('secur')) return 'shield';
    return 'tool';
  };

  const handleDeletePress = (ticket: { id: string; realId?: string; title: string }) => {
    setTicketToDelete(ticket);
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;
    setDeleting(true);
    try {
      if (ticketToDelete.realId) {
        await ticketsApi.deleteTicket(ticketToDelete.realId);
        await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      }
      showToast({
        title: 'Request Removed',
        message: 'The maintenance ticket has been marked as deleted.',
        type: 'info',
      });
      await fetchServerTickets();
    } catch (err) {
      console.warn('Delete ticket error:', err);
      showToast({
        title: 'Delete Failed',
        message: 'Could not delete the maintenance request.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
      setTicketToDelete(null);
    }
  };

  const handleVerifyTicket = async (realId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    try {
      await ticketsApi.verifyTicket(realId, { decision, note: decision === 'REJECTED' ? 'Resident marked as still an issue' : '' });
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      showToast({
        title: decision === 'ACCEPTED' ? 'Request Closed' : 'Issue Reopened',
        message: decision === 'ACCEPTED' ? 'Thank you for confirming.' : 'We will investigate this further.',
        type: decision === 'ACCEPTED' ? 'success' : 'info',
      });
      await fetchServerTickets();
    } catch {
      showToast({
        title: 'Verification Failed',
        message: 'Could not submit your response.',
        type: 'error',
      });
    }
  };

  const activeStatuses = new Set<TicketItem['status']>([
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED_BY_WORKER',
    'PENDING_RESIDENT_CONFIRMATION',
  ]);
  const combinedTickets = serverTickets.map((st) => ({
      id: `REQ-${st.id.slice(0, 4).toUpperCase()}`,
      realId: st.id,
      category: st.category,
      icon: getCategoryIcon(st.category),
      title: st.title,
      description: st.description,
      status: st.status,
      deletedAt: st.deletedAt,
      deletedBy: st.deletedBy,
      assignedStaff: st.tasks?.[0]?.assignedPersonnel?.name,
      staffCategory: st.tasks?.[0]?.assignedPersonnel?.category,
      time: new Date(st.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    }));

  // Tab filtering:
  // Active Requests follow the backend lifecycle exactly.
  // All Requests: complete historical ledger including active, completed, and deleted requests
  const requests =
    activeTab === 'all'
      ? combinedTickets
      : combinedTickets.filter(
          (i) =>
            !i.deletedAt &&
            activeStatuses.has(i.status)
        );

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Maintenance"
        onBackPress={() => smartBack(router, '/services')}
      />

      <View style={styles.tabs}>
        <PremiumPressable
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>Active Requests</Text>
        </PremiumPressable>
        <PremiumPressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All Requests</Text>
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 60 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loading && !refreshing ? (
          <View style={{ gap: 14 }}>
            {[1, 2, 3].map((key) => (
              <View key={key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Skeleton width={100} height={16} borderRadius={6} />
                  <Skeleton width={60} height={16} borderRadius={6} />
                </View>
                <Skeleton width="75%" height={20} borderRadius={8} style={{ marginBottom: 10 }} />
                <Skeleton width="100%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
                <Skeleton width="60%" height={14} borderRadius={6} style={{ marginBottom: 16 }} />
                <View style={styles.cardFooter}>
                  <Skeleton width={80} height={14} borderRadius={6} />
                  <Skeleton width={90} height={24} borderRadius={100} />
                </View>
              </View>
            ))}
          </View>
        ) : requests.length > 0 ? (
          requests.map((req, index) => {
            const isDeleted = Boolean(req.deletedAt) || req.status === 'CANCELLED';
            const isClosed = req.status === 'CLOSED';
            const isPendingVerification = req.status === 'PENDING_RESIDENT_CONFIRMATION';

            const statusLabel = isDeleted
              ? req.deletedBy === 'MANAGEMENT'
                ? 'Deleted by Management'
                : 'Deleted by Resident'
              : req.status === 'OPEN'
              ? 'Open / Unassigned'
              : req.status === 'ASSIGNED'
              ? 'Personnel Assigned'
              : req.status === 'IN_PROGRESS'
              ? 'In Progress'
              : req.status === 'COMPLETED_BY_WORKER'
              ? 'Work Completed'
              : isPendingVerification
              ? 'Needs Your Verification'
              : req.status === 'REOPENED'
              ? 'Reopened'
              : isClosed
              ? 'Closed'
              : req.status;

            return (
              <ScreenEntrance key={req.id} delay={80 + index * 60}>
                <View style={[styles.card, isDeleted && styles.cardDeleted]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.categoryRow}>
                      <Feather name={req.icon} size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.categoryText}>{req.category}</Text>
                    </View>
                    <View style={styles.headerRight}>
                      <Text style={styles.ticketId}>{req.id}</Text>
                      {!isDeleted && (
                        <PremiumPressable
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => handleDeletePress({ id: req.id, realId: req.realId, title: req.title })}
                        >
                          <Feather name="trash-2" size={14} color={theme.colors.textTertiary} />
                        </PremiumPressable>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.title, isDeleted && styles.titleDeleted]}>{req.title}</Text>
                  {Boolean(req.description) && (
                    <Text style={styles.desc} numberOfLines={2}>{req.description}</Text>
                  )}

                  {req.assignedStaff && !isDeleted && (
                    <View style={styles.staffPill}>
                      <Feather name="user" size={12} color="#0284C7" />
                      <Text style={styles.staffPillText}>
                        Assigned: {req.assignedStaff}
                        {req.staffCategory ? ` (${req.staffCategory})` : ''}
                      </Text>
                    </View>
                  )}

                  {isPendingVerification && (
                    <View style={styles.verificationBanner}>
                      <View style={styles.verificationHeader}>
                        <Feather name="check-circle" size={16} color={theme.colors.primary} />
                        <Text style={styles.verificationTitle}>Work Marked Complete</Text>
                      </View>
                      <Text style={styles.verificationPrompt}>
                        The assigned personnel marked this task as resolved. Did everything get completed to your satisfaction?
                      </Text>
                      <View style={styles.verificationActions}>
                        <PremiumPressable
                          style={[styles.verificationButton, styles.verificationButtonConfirm]}
                          onPress={() => handleVerifyTicket(req.realId!, 'ACCEPTED')}
                        >
                          <Feather name="check" size={14} color="#FFFFFF" />
                          <Text style={styles.verificationButtonTextConfirm}>Confirm & Close</Text>
                        </PremiumPressable>
                        <PremiumPressable
                          style={[styles.verificationButton, styles.verificationButtonReject]}
                          onPress={() => handleVerifyTicket(req.realId!, 'REJECTED')}
                        >
                          <Feather name="rotate-ccw" size={14} color="#B45309" />
                          <Text style={styles.verificationButtonTextReject}>Reopen Issue</Text>
                        </PremiumPressable>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.time}>{req.time}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isDeleted
                          ? styles.statusDeleted
                          : isClosed
                          ? styles.statusClosed
                          : isPendingVerification
                          ? styles.statusPendingVerification
                          : req.status === 'OPEN'
                          ? styles.statusPending
                          : styles.statusInProgress,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isDeleted
                            ? styles.statusTextDeleted
                            : isClosed
                            ? styles.statusTextClosed
                            : isPendingVerification
                            ? styles.statusTextPendingVerification
                            : req.status === 'OPEN'
                            ? styles.statusTextPending
                            : styles.statusTextInProgress,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScreenEntrance>
            );
          })
        ) : (
          <EmptyState
            icon="tool"
            title="No maintenance requests"
            description={
              activeTab === 'all'
                ? 'No maintenance history recorded for your unit.'
                : 'You do not have any open active maintenance issues.'
            }
          />
        )}
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(bottom, 16) }]}>
        <Button label="Raise New Request" onPress={() => router.push('/services/raise-issue')} />
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(ticketToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setTicketToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Feather name="alert-triangle" size={24} color="#EF4444" />
            </View>

            <Text style={styles.modalTitle}>Delete Request?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTicketToDelete(null)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                <Text style={styles.modalDeleteText}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: cardSystem.pagePadding },
  tab: { paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },
  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingBottom: 110 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardDeleted: {
    backgroundColor: '#F9FAFB',
    borderColor: 'rgba(0,0,0,0.06)',
    opacity: 0.85,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketId: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, letterSpacing: -0.3, color: theme.colors.textPrimary, marginBottom: 6 },
  titleDeleted: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  desc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: theme.colors.textSecondary, marginBottom: 10, lineHeight: 21 },
  staffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  staffPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#0284C7',
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 98 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusInProgress: { backgroundColor: '#EFF6FF' },
  statusClosed: { backgroundColor: '#ECFDF5' },
  statusDeleted: { backgroundColor: '#FEE2E2' },
  statusText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  statusTextPending: { color: '#B45309' },
  statusTextInProgress: { color: '#1D4ED8' },
  statusTextClosed: { color: '#047857' },
  statusTextDeleted: { color: '#DC2626' },
  verificationBanner: {
    backgroundColor: '#F4F9F5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verificationTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  verificationPrompt: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  verificationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  verificationButtonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  verificationButtonReject: {
    backgroundColor: '#FEF3C7',
  },
  verificationButtonTextConfirm: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  verificationButtonTextReject: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#B45309',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  modalDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  statusPendingVerification: {
    backgroundColor: '#FEF3C7',
  },
  statusTextPendingVerification: {
    color: '#B45309',
  },
});
