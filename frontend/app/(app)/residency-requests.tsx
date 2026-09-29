import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { ConfirmationModal } from '../../src/components/ui/ConfirmationModal';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { useSession } from '../../src/store/auth';
import { propertiesApi, UnitResidencyRecord } from '../../src/api/properties';

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
}

export default function ResidencyRequestsScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const { user, hasOwnership, refreshProfile } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<{ unitNumber: string; unitId: string; residencies: UnitResidencyRecord[] }[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [accessAction, setAccessAction] = useState<{
    unitId: string;
    residencyId: string;
    residentName: string;
    action: 'pause' | 'resume' | 'revoke';
  } | null>(null);
  const [menuAction, setMenuAction] = useState<{
    unitId: string;
    residencyId: string;
    residentName: string;
    status: string;
  } | null>(null);
  const [roleAction, setRoleAction] = useState<{
    unitId: string;
    residencyId: string;
    residentName: string;
  } | null>(null);

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
    } catch (err: unknown) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to approve residency.'));
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
    } catch (err: unknown) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to reject residency.'));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAccessAction = async () => {
    if (!accessAction) return;
    setActionInProgress(accessAction.residencyId);
    try {
      await propertiesApi.updateResidencyAccess(accessAction.unitId, accessAction.residencyId, accessAction.action);
      const verb = accessAction.action === 'pause' ? 'paused' : accessAction.action === 'resume' ? 'restored' : 'revoked';
      Alert.alert('Access Updated', `${accessAction.residentName}'s resident access has been ${verb}.`);
      setAccessAction(null);
      await loadData();
    } catch (err: unknown) {
      Alert.alert('Access Update Failed', getApiErrorMessage(err, 'Could not update resident access.'));
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePromoteToCoOwner = async () => {
    if (!roleAction) return;
    setActionInProgress(roleAction.residencyId);
    try {
      await propertiesApi.updateResidencyRole(roleAction.unitId, roleAction.residencyId, 'CO_OWNER');
      Alert.alert('Co-owner added', `${roleAction.residentName} now has co-owner status for this unit.`);
      setRoleAction(null);
      await loadData();
      await refreshProfile();
    } catch (err: unknown) {
      Alert.alert('Role update failed', getApiErrorMessage(err, 'Could not assign co-owner status.'));
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Verification & Access" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* 1. Tenant View: My Submitted Residency Requests */}
        <ScreenEntrance delay={50}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Credential</Text>

            {myResidencies.length > 0 ? (
              myResidencies.map((r) => (
                <View key={r.id} style={styles.credentialCard}>
                  <View style={styles.credTopRow}>
                    <View>
                      <Text style={styles.credUnit}>UNIT {r.unitNumber || user?.unitNumber || '--'}</Text>
                      <Text style={styles.credRole}>{r.relationshipType}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        r.status === 'ACTIVE'
                          ? styles.badgeActive
                          : r.status === 'PENDING'
                          ? styles.badgePending
                          : styles.badgeError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          r.status === 'ACTIVE'
                            ? styles.badgeActiveText
                            : r.status === 'PENDING'
                            ? styles.badgePendingText
                            : styles.badgeErrorText,
                        ]}
                      >
                        {r.status === 'PENDING' ? 'AWAITING OWNER' : r.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.credDivider} />

                  <Text style={styles.credDesc}>
                    {r.status === 'ACTIVE'
                      ? 'Verified credential. You have full resident access to raise tickets, gate management, and services.'
                      : r.status === 'PENDING'
                      ? 'Verification pending. The property owner has been notified and will verify your tenancy.'
                      : r.status === 'PAUSED'
                      ? 'Access paused. Your resident credential is temporarily inactive.'
                      : r.status === 'REVOKED'
                      ? 'Access revoked by the property owner.'
                      : 'Request declined.'}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No active credentials</Text>
                <Text style={styles.emptyDesc}>You do not have any pending or active residency requests.</Text>
              </View>
            )}
          </View>
        </ScreenEntrance>

        {/* 2. Landlord View: Incoming Tenant Requests for Owned Properties */}
        {isOwner && (
          <ScreenEntrance delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Verification Queue</Text>

              {loading ? (
                <View style={{ gap: 12 }}>
                  <Skeleton height={100} borderRadius={16} />
                  <Skeleton height={100} borderRadius={16} />
                </View>
              ) : incomingRequests.some((i) => i.residencies.length > 0) ? (
                incomingRequests.map((group) => (
                  <View key={group.unitId} style={styles.queueGroup}>
                    <View style={styles.queueHeader}>
                      <Text style={styles.queueUnitTitle}>UNIT {group.unitNumber}</Text>
                    </View>
                    {group.residencies.map((req, idx) => (
                      <View key={req.id} style={[styles.queueItem, idx > 0 && styles.queueItemBorder]}>
                        <View style={styles.queueItemInfo}>
                          <Text style={styles.queueItemName}>{req.user.firstName} {req.user.lastName || ''}</Text>
                          <Text style={styles.queueItemMeta}>
                            {req.relationshipType} • {req.user.email}
                          </Text>
                          {!!req.user.phoneNumber && (
                            <Text style={styles.queueItemMeta}>{req.user.phoneNumber}</Text>
                          )}
                        </View>

                        {req.status === 'PENDING' ? (
                          <View style={styles.queueActionsInline}>
                            <TouchableOpacity
                              style={styles.actionBtnReject}
                              onPress={() => handleReject(group.unitId, req.id, req.user.firstName)}
                              disabled={actionInProgress === req.id}
                            >
                              <Feather name="x" size={18} color={theme.colors.error} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.actionBtnApprove}
                              onPress={() => handleApprove(group.unitId, req.id, req.user.firstName)}
                              disabled={actionInProgress === req.id}
                            >
                              <Feather name="check" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.queueStatusActionRow}>
                            <View
                              style={[
                                styles.badge,
                                req.status === 'ACTIVE'
                                  ? styles.badgeActive
                                  : req.status === 'PAUSED'
                                  ? styles.badgeWarning
                                  : styles.badgeError,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.badgeText,
                                  req.status === 'ACTIVE'
                                    ? styles.badgeActiveText
                                    : req.status === 'PAUSED'
                                    ? styles.badgeWarningText
                                    : styles.badgeErrorText,
                                ]}
                              >
                                {req.status}
                              </Text>
                            </View>

                            {(req.status === 'ACTIVE' || req.status === 'PAUSED') && req.relationshipType !== 'OWNER' && req.relationshipType !== 'CO_OWNER' && (
                              <TouchableOpacity
                                style={styles.kebabBtn}
                                onPress={() => setMenuAction({
                                  unitId: group.unitId,
                                  residencyId: req.id,
                                  residentName: req.user.firstName || 'Resident',
                                  status: req.status
                                })}
                              >
                                <Feather name="more-horizontal" size={20} color={theme.colors.textTertiary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Queue is empty</Text>
                  <Text style={styles.emptyDesc}>No pending verification requests for your properties.</Text>
                </View>
              )}
            </View>
          </ScreenEntrance>
        )}
      </ScrollView>

      <BottomSheet visible={!!menuAction} onClose={() => setMenuAction(null)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Manage Access</Text>
          <Text style={styles.sheetSubtitle}>{menuAction?.residentName}</Text>

            <View style={styles.sheetOptions}>
            <TouchableOpacity
              style={styles.sheetOptionBtn}
              onPress={() => {
                const ma = menuAction;
                setMenuAction(null);
                if (ma) setRoleAction({ unitId: ma.unitId, residencyId: ma.residencyId, residentName: ma.residentName });
              }}
            >
              <Feather name="user-check" size={20} color={theme.colors.primary} />
              <Text style={styles.sheetOptionText}>Make co-owner</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity
              style={styles.sheetOptionBtn}
              onPress={() => {
                const ma = menuAction;
                setMenuAction(null);
                if (ma) {
                  setAccessAction({
                    unitId: ma.unitId,
                    residencyId: ma.residencyId,
                    residentName: ma.residentName,
                    action: ma.status === 'PAUSED' ? 'resume' : 'pause',
                  });
                }
              }}
            >
              <Feather name={menuAction?.status === 'PAUSED' ? 'play' : 'pause'} size={20} color={theme.colors.textPrimary} />
              <Text style={styles.sheetOptionText}>{menuAction?.status === 'PAUSED' ? 'Restore Access' : 'Pause Access'}</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity
              style={styles.sheetOptionBtn}
              onPress={() => {
                const ma = menuAction;
                setMenuAction(null);
                if (ma) {
                  setAccessAction({
                    unitId: ma.unitId,
                    residencyId: ma.residencyId,
                    residentName: ma.residentName,
                    action: 'revoke',
                  });
                }
              }}
            >
              <Feather name="slash" size={20} color={theme.colors.error} />
              <Text style={[styles.sheetOptionText, { color: theme.colors.error }]}>Revoke Permanently</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      <ConfirmationModal
        visible={!!accessAction}
        onClose={() => setAccessAction(null)}
        onConfirm={handleAccessAction}
        title={accessAction?.action === 'revoke' ? 'Revoke access?' : accessAction?.action === 'pause' ? 'Pause access?' : 'Restore access?'}
        message={accessAction?.action === 'revoke'
          ? `${accessAction.residentName} will lose access to this unit and will need to submit a new request to return.`
          : accessAction?.action === 'pause'
          ? `${accessAction.residentName} will temporarily lose resident access. You can restore it later.`
          : `${accessAction?.residentName || 'This resident'} will regain access to this unit.`}
        confirmLabel={accessAction?.action === 'revoke' ? 'Revoke access' : accessAction?.action === 'pause' ? 'Pause access' : 'Restore access'}
        variant={accessAction?.action === 'revoke' ? 'danger' : accessAction?.action === 'pause' ? 'warning' : 'default'}
        loading={!!accessAction && actionInProgress === accessAction.residencyId}
      />

      <ConfirmationModal
        visible={!!roleAction}
        onClose={() => setRoleAction(null)}
        onConfirm={handlePromoteToCoOwner}
        title="Make co-owner?"
        message={`${roleAction?.residentName || 'This resident'} will become a co-owner of the unit. Only two active co-owners are allowed besides the owner.`}
        confirmLabel="Make co-owner"
        loading={!!roleAction && actionInProgress === roleAction.residencyId}
      />
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
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  
  // Credentials (Tenant View)
  credentialCard: {
    backgroundColor: '#F7FAF8',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  credTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  credUnit: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  credRole: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.primary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  credDivider: {
    height: 1,
    backgroundColor: 'rgba(20, 61, 42, 0.06)',
    marginVertical: 16,
  },
  credDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  // Empty states
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },

  // Queue (Landlord View)
  queueGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    overflow: 'hidden',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  queueHeader: {
    backgroundColor: 'rgba(20, 61, 42, 0.02)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 61, 42, 0.06)',
  },
  queueUnitTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  queueItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(20, 61, 42, 0.04)',
  },
  queueItemInfo: {
    flex: 1,
    paddingRight: 16,
  },
  queueItemName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  queueItemMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  
  queueActionsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnApprove: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnReject: {
    backgroundColor: theme.colors.errorBackground,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  queueStatusActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kebabBtn: {
    padding: 4,
    marginRight: -4,
  },

  // Badges
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeActive: {
    backgroundColor: theme.colors.successBackground,
  },
  badgeActiveText: {
    color: theme.colors.success,
  },
  badgePending: {
    backgroundColor: theme.colors.surfaceAmber,
  },
  badgePendingText: {
    color: theme.colors.accent,
  },
  badgeWarning: {
    backgroundColor: theme.colors.surfaceAmber,
  },
  badgeWarningText: {
    color: theme.colors.accent,
  },
  badgeError: {
    backgroundColor: theme.colors.errorBackground,
  },
  badgeErrorText: {
    color: theme.colors.error,
  },

  // Menu Sheet
  sheetContent: {
    backgroundColor: theme.colors.surface,
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  sheetOptions: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  sheetOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(20, 61, 42, 0.05)',
  },
});
