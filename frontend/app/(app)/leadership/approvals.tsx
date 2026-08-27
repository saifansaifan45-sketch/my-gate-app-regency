import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { useToast } from '../../../src/store/toast';
import { leadershipApi, PendingManagerItem, LeadershipOverviewResponse } from '../../../src/api/leadership';
import { parseApiError } from '../../../src/utils/api-error';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function LeadershipApprovalsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'managers' | 'workforce' | 'history'>('managers');
  const [pendingManagers, setPendingManagers] = useState<PendingManagerItem[]>([]);
  const [overviewData, setOverviewData] = useState<LeadershipOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Review Modal State
  const [selectedApplicant, setSelectedApplicant] = useState<PendingManagerItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const loadApprovals = useCallback(async () => {
    try {
      const [pendingRes, overviewRes] = await Promise.allSettled([
        leadershipApi.getPendingManagers(),
        leadershipApi.getOverview(),
      ]);

      if (pendingRes.status === 'fulfilled') {
        setPendingManagers(pendingRes.value.pendingManagers || []);
      }
      if (overviewRes.status === 'fulfilled') {
        setOverviewData(overviewRes.value);
      }
    } catch (err) {
      console.warn('Failed to load approval center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const onRefresh = () => {
    setRefreshing(true);
    loadApprovals();
  };

  const handleApprove = async (item: PendingManagerItem) => {
    setActionLoading(true);
    try {
      await leadershipApi.approveManager(item.id, reviewNote.trim() || undefined);
      showToast({
        title: 'Manager Approved',
        message: `${item.user.firstName || 'Applicant'} is now an active Operations Manager.`,
        type: 'success',
      });
      setSelectedApplicant(null);
      setReviewNote('');
      await loadApprovals();
    } catch (err) {
      showToast({
        title: 'Approval Failed',
        message: parseApiError(err, 'Could not approve manager application.'),
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (item: PendingManagerItem) => {
    setActionLoading(true);
    try {
      await leadershipApi.rejectManager(item.id, reviewNote.trim() || undefined);
      showToast({
        title: 'Application Rejected',
        message: `The manager request for ${item.user.firstName || 'Applicant'} has been rejected.`,
        type: 'info',
      });
      setSelectedApplicant(null);
      setReviewNote('');
      await loadApprovals();
    } catch (err) {
      showToast({
        title: 'Rejection Failed',
        message: parseApiError(err, 'Could not reject manager application.'),
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async (item: PendingManagerItem) => {
    setActionLoading(true);
    try {
      await leadershipApi.blockManager(item.id, reviewNote.trim() || undefined);
      showToast({
        title: 'Applicant Blocked',
        message: `The applicant has been blocked from accessing managerial features.`,
        type: 'error',
      });
      setSelectedApplicant(null);
      setReviewNote('');
      await loadApprovals();
    } catch (err) {
      showToast({
        title: 'Action Failed',
        message: parseApiError(err, 'Could not block applicant.'),
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const stats = overviewData?.stats;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Approval Center"
        onBackPress={() => smartBack(router, '/leadership')}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <PremiumPressable
          style={[styles.tabItem, activeTab === 'managers' && styles.tabItemActive]}
          onPress={() => setActiveTab('managers')}
        >
          <Text style={[styles.tabText, activeTab === 'managers' && styles.tabTextActive]}>
            Manager Requests ({pendingManagers.length})
          </Text>
        </PremiumPressable>

        <PremiumPressable
          style={[styles.tabItem, activeTab === 'workforce' && styles.tabItemActive]}
          onPress={() => setActiveTab('workforce')}
        >
          <Text style={[styles.tabText, activeTab === 'workforce' && styles.tabTextActive]}>
            Workforce Overview
          </Text>
        </PremiumPressable>

        <PremiumPressable
          style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Tab 1: Manager Applications */}
        {activeTab === 'managers' && (
          <>
            {loading ? (
              <View style={{ gap: 12 }}>
                <Skeleton width="100%" height={140} style={{ borderRadius: 18 }} />
                <Skeleton width="100%" height={140} style={{ borderRadius: 18 }} />
              </View>
            ) : pendingManagers.length > 0 ? (
              pendingManagers.map((item) => {
                const name = `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim() || 'Manager Applicant';
                return (
                  <ScreenEntrance key={item.id} delay={60}>
                    <View style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.applicantAvatar}>
                          <Feather name="user-check" size={20} color="#047857" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.applicantName}>{name}</Text>
                          <Text style={styles.applicantEmail}>{item.user.email}</Text>
                          {item.user.phoneNumber ? (
                            <Text style={styles.applicantPhone}>{item.user.phoneNumber}</Text>
                          ) : null}
                        </View>
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>PENDING</Text>
                        </View>
                      </View>

                      <View style={styles.cardInfoGrid}>
                        <View style={styles.infoCol}>
                          <Text style={styles.infoColLabel}>Role Requested</Text>
                          <Text style={styles.infoColValue}>Community Manager</Text>
                        </View>
                        <View style={styles.infoCol}>
                          <Text style={styles.infoColLabel}>Submitted</Text>
                          <Text style={styles.infoColValue}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardActionsRow}>
                        <Button
                          label="Review"
                          variant="secondary"
                          icon="eye"
                          onPress={() => setSelectedApplicant(item)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Approve"
                          icon="check"
                          onPress={() => handleApprove(item)}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                  </ScreenEntrance>
                );
              })
            ) : (
              <EmptyState
                icon="check-circle"
                title="No Pending Manager Requests"
                description="All manager applications have been reviewed. New applications will appear here."
              />
            )}
          </>
        )}

        {/* Tab 2: Workforce Overview */}
        {activeTab === 'workforce' && (
          <ScreenEntrance delay={60}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="shield" size={18} color="#143D2A" />
                <Text style={styles.cardHeaderTitle}>Township Workforce Strength</Text>
              </View>
              <Text style={styles.workforceNote}>
                Workforce personnel applications are managed and approved by Operations Managers. Leadership maintains oversight.
              </Text>

              <View style={styles.breakdownList}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Security Staff</Text>
                  <Text style={styles.breakdownVal}>{stats?.workforceBreakdown?.security ?? 0}</Text>
                </View>
                <View style={styles.summaryDivider} />

                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Maintenance / Electrical / Plumbing</Text>
                  <Text style={styles.breakdownVal}>{stats?.workforceBreakdown?.maintenance ?? 0}</Text>
                </View>
                <View style={styles.summaryDivider} />

                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Housekeeping / Facility Cleaners</Text>
                  <Text style={styles.breakdownVal}>{stats?.workforceBreakdown?.housekeeping ?? 0}</Text>
                </View>
                <View style={styles.summaryDivider} />

                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Other Operational Staff</Text>
                  <Text style={styles.breakdownVal}>{stats?.workforceBreakdown?.other ?? 0}</Text>
                </View>
              </View>
            </View>
          </ScreenEntrance>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <ScreenEntrance delay={60}>
            {overviewData?.recentApprovals && overviewData.recentApprovals.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Recently Approved Operational Roles</Text>
                <View style={{ marginTop: 12 }}>
                  {overviewData.recentApprovals.map((item, idx) => (
                    <View key={item.id}>
                      <View style={styles.historyItem}>
                        <View style={styles.historyIconBox}>
                          <Feather name="check" size={16} color="#047857" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyName}>{item.userName}</Text>
                          <Text style={styles.historySub}>
                            {item.role} · {item.email}
                          </Text>
                        </View>
                        <Text style={styles.historyTime}>
                          {new Date(item.approvedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {idx < overviewData.recentApprovals.length - 1 && <View style={styles.summaryDivider} />}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <EmptyState
                icon="clock"
                title="No Approval History Yet"
                description="Past approval decisions and activations will be archived here."
              />
            )}
          </ScreenEntrance>
        )}
      </ScrollView>

      {/* Decision Modal */}
      {selectedApplicant && (
        <Modal
          visible={Boolean(selectedApplicant)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedApplicant(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Feather name="shield" size={20} color="#143D2A" />
                  <Text style={styles.modalTitle}>Review Application</Text>
                </View>
                <PremiumPressable onPress={() => setSelectedApplicant(null)} style={styles.modalCloseBtn}>
                  <Feather name="x" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>

              <View style={styles.modalApplicantBox}>
                <Text style={styles.modalApplicantName}>
                  {`${selectedApplicant.user.firstName || ''} ${selectedApplicant.user.lastName || ''}`.trim() || 'Manager Applicant'}
                </Text>
                <Text style={styles.modalApplicantEmail}>{selectedApplicant.user.email}</Text>
                {selectedApplicant.user.phoneNumber ? (
                  <Text style={styles.modalApplicantPhone}>{selectedApplicant.user.phoneNumber}</Text>
                ) : null}
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Requested Role:</Text>
                <Text style={styles.modalInfoValue}>Community Manager</Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Review Authority:</Text>
                <Text style={styles.modalInfoValue}>Township Leadership</Text>
              </View>

              <Text style={styles.inputLabel}>Optional Governance Notes</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Verified residential credentials and background."
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholderTextColor={theme.colors.textSecondary}
                multiline
              />

              <View style={styles.modalActions}>
                <Button
                  label="Approve Access"
                  icon="check"
                  onPress={() => handleApprove(selectedApplicant)}
                  loading={actionLoading}
                  style={{ marginBottom: 8 }}
                />
                <Button
                  label="Reject Application"
                  variant="secondary"
                  icon="x"
                  onPress={() => handleReject(selectedApplicant)}
                  loading={actionLoading}
                  style={{ marginBottom: 8 }}
                />
                <PremiumPressable
                  style={styles.blockBtn}
                  onPress={() => handleBlock(selectedApplicant)}
                  disabled={actionLoading}
                >
                  <Feather name="slash" size={14} color="#DC2626" />
                  <Text style={styles.blockBtnText}>Block Applicant Permanently</Text>
                </PremiumPressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: cardSystem.pagePadding,
    gap: 8,
    paddingBottom: 12,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  applicantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applicantName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15.5,
    color: theme.colors.textPrimary,
  },
  applicantEmail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  applicantPhone: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
  },
  pendingBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#B45309',
    letterSpacing: 0.5,
  },
  cardInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoColLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  infoColValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardHeaderTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  workforceNote: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  breakdownList: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 14,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  breakdownVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  historyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  historySub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  historyTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplicantBox: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  modalApplicantName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  modalApplicantEmail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalApplicantPhone: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.primary,
    marginTop: 2,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 4,
  },
  modalInfoLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  modalInfoValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    marginTop: 4,
  },
  blockBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  blockBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: '#DC2626',
  },
});
