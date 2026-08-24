import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { useSession } from '../../src/store/auth';
import { propertiesApi, UnitResidencyRecord } from '../../src/api/properties';

export default function ResidencyRequestsScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const { user, hasOwnership, refreshProfile } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<{ unitNumber: string; unitId: string; residencies: UnitResidencyRecord[] }[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const isOwner = hasOwnership();
  const myResidencies = user?.residencies || [];

  const loadData = useCallback(async () => {
    try {
      if (isOwner && user?.ownerships && user.ownerships.length > 0) {
        const results = await Promise.all(
          user.ownerships.map(async (o) => {
            const data = await propertiesApi.getUnitResidencies(o.unitId).catch(() => ({ residencies: [] }));
            return {
              unitId: o.unitId,
              unitNumber: o.unitNumber || 'Unit',
              residencies: data.residencies,
            };
          })
        );
        setIncomingRequests(results);
      }
    } catch (err) {
      console.warn('Failed to load residency requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOwner, user?.ownerships]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadData();
  };

  const handleApprove = async (unitId: string, residencyId: string, applicantName: string) => {
    setActionInProgress(residencyId);
    try {
      await propertiesApi.approveResidency(unitId, residencyId);
      Alert.alert('Residency Approved', `Approved residency access for ${applicantName}.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to approve residency.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (unitId: string, residencyId: string, applicantName: string) => {
    setActionInProgress(residencyId);
    try {
      await propertiesApi.rejectResidency(unitId, residencyId);
      Alert.alert('Residency Rejected', `Declined residency request for ${applicantName}.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to reject residency.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Residency & Verification" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* 1. Tenant View: My Submitted Residency Requests */}
        <ScreenEntrance delay={50}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Residency Status</Text>

            {myResidencies.length > 0 ? (
              myResidencies.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: '#F3F8F5' }]}>
                      <Feather name="home" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Unit {r.unitNumber || user?.unitNumber || 'Unit'}</Text>
                      <Text style={styles.cardSubtitle}>
                        Role: {r.relationshipType}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        r.status === 'ACTIVE'
                          ? styles.statusActive
                          : r.status === 'PENDING'
                          ? styles.statusPending
                          : styles.statusRejected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          r.status === 'ACTIVE'
                            ? styles.statusActiveText
                            : r.status === 'PENDING'
                            ? styles.statusPendingText
                            : styles.statusRejectedText,
                        ]}
                      >
                        {r.status === 'PENDING' ? 'Waiting for Owner Approval' : r.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.statusDescription}>
                    {r.status === 'ACTIVE'
                      ? '✓ Verified & Active: You have full resident access to raise tickets, gate management, and services.'
                      : r.status === 'PENDING'
                      ? '⏳ Pending Verification: The property owner has been notified and will verify your tenancy.'
                      : '✕ Request Declined: Please contact your property owner or township management.'}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Feather name="info" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>You do not have any pending residency requests.</Text>
              </View>
            )}
          </View>
        </ScreenEntrance>

        {/* 2. Landlord View: Incoming Tenant Requests for Owned Properties */}
        {isOwner && (
          <ScreenEntrance delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tenant Verification Requests</Text>

              {loading ? (
                <View style={{ gap: 12 }}>
                  <Skeleton height={120} borderRadius={18} />
                  <Skeleton height={120} borderRadius={18} />
                </View>
              ) : incomingRequests.some((i) => i.residencies.length > 0) ? (
                incomingRequests.map((group) =>
                  group.residencies.map((req) => (
                    <View key={req.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                          <Feather name="user-check" size={20} color={theme.colors.accent} />
                        </View>
                        <View style={styles.cardHeaderText}>
                          <Text style={styles.cardTitle}>
                            {req.user.firstName} {req.user.lastName || ''}
                          </Text>
                          <Text style={styles.cardSubtitle}>
                            Requesting Unit {group.unitNumber} ({req.relationshipType})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            req.status === 'ACTIVE' ? styles.statusActive : styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              req.status === 'ACTIVE' ? styles.statusActiveText : styles.statusPendingText,
                            ]}
                          >
                            {req.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.applicantInfo}>
                        Contact: {req.user.email} {req.user.phoneNumber ? `• ${req.user.phoneNumber}` : ''}
                      </Text>

                      {req.status === 'PENDING' && (
                        <View style={styles.actionRow}>
                          <Button
                            label="Reject"
                            variant="dangerOutline"
                            icon="x"
                            onPress={() => handleReject(group.unitId, req.id, req.user.firstName)}
                            disabled={actionInProgress === req.id}
                            loading={actionInProgress === req.id}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="Approve"
                            icon="check"
                            onPress={() => handleApprove(group.unitId, req.id, req.user.firstName)}
                            disabled={actionInProgress === req.id}
                            loading={actionInProgress === req.id}
                            style={{ flex: 1 }}
                          />
                        </View>
                      )}
                    </View>
                  ))
                )
              ) : (
                <View style={styles.emptyCard}>
                  <Feather name="check-circle" size={20} color={theme.colors.primary} />
                  <Text style={styles.emptyText}>No pending tenant verification requests for your properties.</Text>
                </View>
              )}
            </View>
          </ScreenEntrance>
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
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginLeft: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusActiveText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#059669',
  },
  statusPending: {
    backgroundColor: '#FFF7ED',
  },
  statusPendingText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#C2410C',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusRejectedText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#D32F2F',
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  statusDescription: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  applicantInfo: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 10,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
});
