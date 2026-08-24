import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { useToast } from '../../../src/store/toast';
import { managerApi, PendingWorkforceItem } from '../../../src/api/manager';
import { parseApiError } from '../../../src/utils/api-error';

export default function ManagerWorkforceApprovalsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [pendingList, setPendingList] = useState<PendingWorkforceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadPendingWorkforce = useCallback(async () => {
    try {
      const res = await managerApi.getPendingWorkforce();
      setPendingList(res.pendingWorkforce || []);
    } catch (err) {
      console.warn('Failed to load pending workforce applications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPendingWorkforce();
  }, [loadPendingWorkforce]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPendingWorkforce();
  };

  const handleApprove = async (item: PendingWorkforceItem) => {
    setActionLoadingId(item.id);
    try {
      await managerApi.approveWorkforce(item.id);
      showToast({
        title: 'Workforce Approved',
        message: `${item.user.firstName || 'Staff applicant'} is now active with default Off Duty status.`,
        type: 'success',
      });
      await loadPendingWorkforce();
    } catch (err) {
      showToast({
        title: 'Approval Failed',
        message: parseApiError(err, 'Could not approve workforce application.'),
        type: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (item: PendingWorkforceItem) => {
    setActionLoadingId(item.id);
    try {
      await managerApi.rejectWorkforce(item.id);
      showToast({
        title: 'Application Rejected',
        message: `Workforce application for ${item.user.firstName || 'Applicant'} was rejected.`,
        type: 'info',
      });
      await loadPendingWorkforce();
    } catch (err) {
      showToast({
        title: 'Rejection Failed',
        message: parseApiError(err, 'Could not reject workforce application.'),
        type: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Workforce Approvals"
        onBackPress={() => smartBack(router, '/manager')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Review Notice */}
        <ScreenEntrance delay={40}>
          <View style={styles.noticeCard}>
            <Feather name="info" size={16} color="#047857" />
            <Text style={styles.noticeText}>
              Approved personnel will receive an active profile with default Off Duty status until they check in.
            </Text>
          </View>
        </ScreenEntrance>

        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={150} style={{ borderRadius: 18 }} />
            <Skeleton width="100%" height={150} style={{ borderRadius: 18 }} />
          </View>
        ) : pendingList.length > 0 ? (
          pendingList.map((item, idx) => {
            const name = `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim() || 'Workforce Applicant';
            const isActing = actionLoadingId === item.id;

            return (
              <ScreenEntrance key={item.id} delay={60 + idx * 40}>
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatarBox}>
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

                  <View style={styles.detailsRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Requested Role</Text>
                      <Text style={styles.detailVal}>{(item as any).requestedCategory || item.role || 'Staff Member'}</Text>
                    </View>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Applied Date</Text>
                      <Text style={styles.detailVal}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <Button
                      label="Reject"
                      variant="secondary"
                      icon="x"
                      onPress={() => handleReject(item)}
                      loading={isActing}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Approve"
                      icon="check"
                      onPress={() => handleApprove(item)}
                      loading={isActing}
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
            title="No Pending Workforce Requests"
            description="All staff and workforce applications have been processed. New requests will appear here."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 18,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#047857',
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 20,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: '#B45309',
    letterSpacing: 0.5,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
