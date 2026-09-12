import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { smartBack } from '../../../src/navigation/history';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { visitorsApi, VisitorItem } from '../../../src/api/visitors';
import { useToast } from '../../../src/store/toast';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function VisitorDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [newOtp, setNewOtp] = useState<string | null>(null);

  const { data: visitorsData, isLoading } = useQuery({
    queryKey: ['my-visitors'],
    queryFn: () => visitorsApi.getMyVisitors(),
  });

  const visitor: VisitorItem | undefined = visitorsData?.visitors.find((v: VisitorItem) => v.id === id);

  const approveMut = useMutation({
    mutationFn: (visitorId: string) => visitorsApi.approveVisitor(visitorId),
    onSuccess: (data) => {
      showToast({ title: 'Visitor Approved', message: 'Gate pass generated securely.', type: 'success' });
      // The backend returns the one-time plaintext OTP here!
      if (data.visitor.otp) {
        setNewOtp(data.visitor.otp);
      }
      queryClient.invalidateQueries({ queryKey: ['my-visitors'] });
    },
    onError: (err: any) => {
      showToast({ title: 'Approval Failed', message: err?.response?.data?.error?.message || 'Could not approve', type: 'error' });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (visitorId: string) => visitorsApi.rejectVisitor(visitorId),
    onSuccess: () => {
      showToast({ title: 'Visitor Denied', message: 'Entry request rejected.', type: 'warning' });
      queryClient.invalidateQueries({ queryKey: ['my-visitors'] });
    },
    onError: (err: any) => {
      showToast({ title: 'Action Failed', message: err?.response?.data?.error?.message || 'Could not update status', type: 'error' });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (visitorId: string) => visitorsApi.revokeVisitor(visitorId),
    onSuccess: () => {
      showToast({ title: 'Pass Revoked', message: 'The active pass has been revoked.', type: 'warning' });
      queryClient.invalidateQueries({ queryKey: ['my-visitors'] });
    },
    onError: (err: any) => {
      showToast({ title: 'Revoke Failed', message: err?.response?.data?.error?.message || 'Could not revoke', type: 'error' });
    },
  });

  const handleCopy = async () => {
    if (!newOtp) return;
    await Clipboard.setStringAsync(newOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = () => {
    if (!newOtp) return;
    Share.share({
      message: `Your entry pass for Regency Salma is ${newOtp}. Please show this at the gate.`,
      title: 'Regency Salma Entry Pass',
    });
  };

  if (isLoading || !visitor) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const initial = (visitor.name || 'V').charAt(0).toUpperCase();

  const isPending = visitor.status === 'PENDING';
  const isApproved = visitor.status === 'APPROVED';
  
  // Real-time timeline extraction
  const createdTime = new Date(visitor.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  const checkInTime = visitor.checkInTime ? new Date(visitor.checkInTime).toLocaleString([], { timeStyle: 'short' }) : null;
  const checkOutTime = visitor.checkOutTime ? new Date(visitor.checkOutTime).toLocaleString([], { timeStyle: 'short' }) : null;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Pass Details"
        onBackPress={() => smartBack(router, '/visitors')}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]} showsVerticalScrollIndicator={false}>
        
        {/* Top Profile block */}
        <View style={styles.profileSection}>
          <View style={[styles.avatar, (visitor.status === 'REJECTED' || visitor.status === 'REVOKED') && { backgroundColor: '#FEE2E2' }]}>
            <Feather name={visitor.visitorType === 'DELIVERY' ? 'package' : visitor.visitorType === 'CAB' ? 'map-pin' : 'user'} size={32} color={(visitor.status === 'REJECTED' || visitor.status === 'REVOKED') ? '#DC2626' : theme.colors.primary} />
          </View>
          <Text style={styles.name}>{visitor.visitorType === 'DELIVERY' ? visitor.provider || 'Delivery' : visitor.name}</Text>
          <Text style={styles.type}>{visitor.visitorType} · {visitor.status === 'CHECKED_IN' && visitor.handoffTimestamp ? 'AWAITING GATE CHECK-OUT' : visitor.status}</Text>
        </View>

        {/* Dynamic OTP Panel if just approved */}
        {Boolean(newOtp) && (
          <View style={styles.otpCard}>
            <View style={styles.otpIconWrap}>
              <Feather name="shield" size={24} color="#FFF" />
            </View>
            <Text style={styles.otpLabel}>ONE-TIME ENTRY CODE</Text>
            <Text style={styles.otpValue}>{newOtp ? newOtp.split('').join(' ') : ''}</Text>
            <Text style={styles.otpNotice}>Copy or share this code now. It will not be shown again for security reasons.</Text>
            
            <View style={styles.otpActions}>
              <PremiumPressable style={styles.otpBtn} onPress={handleCopy}>
                <Feather name={copied ? "check" : "copy"} size={16} color={theme.colors.primary} />
                <Text style={styles.otpBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
              </PremiumPressable>
              <PremiumPressable style={styles.otpBtn} onPress={handleShare}>
                <Feather name="share-2" size={16} color={theme.colors.primary} />
                <Text style={styles.otpBtnText}>Share</Text>
              </PremiumPressable>
            </View>
          </View>
        )}

        {/* Timeline / Activity */}
        <Text style={styles.sectionTitle}>Activity Timeline</Text>
        <View style={styles.timelineCard}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Pass Created</Text>
              <Text style={styles.timelineTime}>{createdTime}</Text>
            </View>
          </View>
          
          {Boolean(checkInTime) && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Arrived at Gate</Text>
                <Text style={styles.timelineTime}>{checkInTime}</Text>
              </View>
            </View>
          )}

          {Boolean(checkOutTime) && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{visitor.visitorType === 'DELIVERY' ? 'Handoff Complete' : 'Checked Out'}</Text>
                <Text style={styles.timelineTime}>{checkOutTime}</Text>
              </View>
            </View>
          )}

          {(visitor.status === 'REJECTED' || visitor.status === 'REVOKED') && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineLine, { backgroundColor: '#DC2626' }]} />
              <View style={[styles.timelineDot, { backgroundColor: '#DC2626' }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: '#DC2626' }]}>Pass {visitor.status === 'REVOKED' ? 'Revoked' : 'Denied'}</Text>
                <Text style={styles.timelineTime}>Access cancelled</Text>
              </View>
            </View>
          )}
        </View>

        
        {visitor.visitorType === 'DELIVERY' && visitor.handoffTimestamp && (
          <>
            <Text style={styles.sectionTitle}>Delivery Handoff Receipt</Text>
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <Feather name="check-circle" size={18} color="#059669" />
                <Text style={styles.receiptTitle}>Successfully Delivered</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Handed off to</Text>
                <Text style={styles.detailValue}>{visitor.handoffRecipientType === 'SECURITY' ? 'Gate Security' : visitor.handoffRecipientType === 'LOCKER' ? 'Parcel Locker' : 'Resident (Door)'}</Text>
              </View>
              {Boolean(visitor.handoffRecipientName) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recipient Name</Text>
                  <Text style={styles.detailValue}>{visitor.handoffRecipientName}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Handoff Time</Text>
                <Text style={styles.detailValue}>{new Date(visitor.handoffTimestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
              </View>
              {Boolean(visitor.handoffProofReference) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Proof Reference</Text>
                  <Text style={styles.detailValue}>{visitor.handoffProofReference}</Text>
                </View>
              )}
            </View>
          </>
        )}

        
        {visitor.visitorType === 'DELIVERY' && visitor.status === 'CHECKED_OUT' && !visitor.handoffTimestamp && (
          <>
            <Text style={styles.sectionTitle}>Delivery Exception</Text>
            <View style={[styles.receiptCard, { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }]}>
              <View style={styles.receiptHeader}>
                <Feather name="alert-triangle" size={18} color="#D97706" />
                <Text style={[styles.receiptTitle, { color: '#B45309' }]}>No Handoff Record</Text>
              </View>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#92400E' }}>
                This delivery agent checked out of the gate, but security did not log a completed package handoff.
              </Text>
            </View>
          </>
        )}

        {/* Pass Details */}
        <Text style={styles.sectionTitle}>Pass Details</Text>
        <View style={styles.detailsCard}>
          {visitor.provider && (visitor.visitorType === 'DELIVERY' || visitor.visitorType === 'CAB') && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Provider</Text>
                <Text style={styles.detailValue}>{visitor.provider}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          {visitor.name && visitor.visitorType !== 'CAB' && visitor.visitorType !== 'DELIVERY' && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Person Name</Text>
                <Text style={styles.detailValue}>{visitor.name}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          {Boolean(visitor.phone) && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>{visitor.phone}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          {Boolean(visitor.purpose) && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purpose</Text>
                <Text style={styles.detailValue}>{visitor.purpose}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          {Boolean(visitor.vehicleNumber) && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Number</Text>
                <Text style={styles.detailValue}>{visitor.vehicleNumber}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          {Boolean(visitor.orderReference) && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order Ref</Text>
                <Text style={styles.detailValue}>{visitor.orderReference}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expected Arrival</Text>
            <Text style={styles.detailValue}>{new Date(visitor.validFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
          </View>
        </View>

        {/* Conditional Management Actions */}
        {isPending && (
          <View style={styles.actionsBox}>
            <Text style={styles.actionsTitle}>Pending Request</Text>
            <Text style={styles.actionsSub}>This person is requesting entry to your unit.</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              <Button
                label="Approve Entry"
                icon="check"
                loading={approveMut.isPending}
                onPress={() => approveMut.mutate(visitor.id)}
              />
              <Button
                label="Deny Entry"
                icon="x"
                variant="dangerOutline"
                loading={rejectMut.isPending}
                onPress={() => rejectMut.mutate(visitor.id)}
              />
            </View>
          </View>
        )}

        {isApproved && (
          <View style={[styles.actionsBox, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.actionsTitle, { color: '#B91C1C' }]}>Danger Zone</Text>
            <Text style={styles.actionsSub}>Cancel this gate pass and deny entry.</Text>
            <View style={{ marginTop: 12 }}>
              <Button
                label="Revoke Pass"
                icon="shield-off"
                variant="dangerOutline"
                loading={revokeMut.isPending}
                onPress={() => revokeMut.mutate(visitor.id)}
              />
            </View>
          </View>
        )}
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 16 },
  
  profileSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: theme.colors.primary },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, letterSpacing: -0.3, color: theme.colors.textPrimary, marginBottom: 4 },
  type: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12, marginTop: 10 },
  
  timelineCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 46 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, zIndex: 2 },
  timelineLine: { position: 'absolute', left: 4.5, top: -35, width: 1, height: 40, zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1 },
  timelineTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textPrimary },
  timelineTime: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  detailsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, alignItems: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.04)' },
  detailLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary },
  detailValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: theme.colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },

  
  receiptCard: {
    backgroundColor: '#F3F8F5', borderRadius: 18, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#10B981',
  },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  receiptTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#059669' },
  actionsBox: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  actionsTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary },
  actionsSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 4 },

  otpCard: {
    backgroundColor: theme.colors.primary, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 28,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  otpIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  otpLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 12 },
  otpValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 38, color: '#FFF', letterSpacing: 8, marginBottom: 16 },
  otpNotice: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  otpActions: { flexDirection: 'row', gap: 12 },
  otpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 98 },
  otpBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.primary },
});
