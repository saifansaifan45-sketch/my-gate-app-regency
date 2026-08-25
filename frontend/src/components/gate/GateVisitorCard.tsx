import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { theme } from '../../theme';
import { VisitorItem } from '../../api/visitors';

interface GateVisitorCardProps {
  visitor: VisitorItem;
  onCheckIn: (id: string, otp?: string) => void;
  onCheckOut: (id: string) => void;
  onHandoff: (visitor: VisitorItem) => void;
  onRecordArrival: (unitId: string) => void;
  onApprove?: (visitor: VisitorItem) => void;
  onReject?: (visitor: VisitorItem) => void;
  hostActionPending?: string | null;
  checkInPending?: string | null;
  checkOutPending?: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string; icon: keyof typeof Feather.glyphMap }> = {
  PENDING: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', label: 'Waiting for resident', icon: 'clock' },
  APPROVED: { bg: '#ECFDF5', text: '#047857', dot: '#10B981', label: 'Approved - Ready', icon: 'check-circle' },
  CHECKED_IN: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'Inside', icon: 'log-in' },
};

const TYPE_META: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bg: string; label: string }> = {
  GUEST: { icon: 'user', color: '#143D2A', bg: '#E8F5E9', label: 'Guest' },
  CAB: { icon: 'truck', color: '#2563EB', bg: '#EAF1FF', label: 'Cab' },
  DELIVERY: { icon: 'package', color: '#A16207', bg: '#FFF3D6', label: 'Delivery' },
  SERVICE: { icon: 'briefcase', color: '#7C3AED', bg: '#F3E8FF', label: 'Service' },
  OTHER: { icon: 'user', color: '#6B7280', bg: '#F3F4F6', label: 'Other' },
};

export function GateVisitorCard({ visitor, onCheckIn, onCheckOut, onHandoff, onRecordArrival: _onRecordArrival, onApprove, onReject, hostActionPending, checkInPending, checkOutPending }: GateVisitorCardProps) {
  const meta = STATUS_STYLE[visitor.status] || STATUS_STYLE.PENDING;
  const typeMeta = TYPE_META[visitor.visitorType] || TYPE_META.OTHER;
  const name = visitor.provider || visitor.name;
  const unitLabel = visitor.unit?.unitNumber || '—';
  const hostLabel = visitor.hostUser
    ? `${visitor.hostUser.firstName || ''} ${visitor.hostUser.lastName || ''}`.trim() || 'Manager'
    : null;
  const isCheckingIn = checkInPending === visitor.id;
  const isCheckingOut = checkOutPending === visitor.id;
  const isHostActionPending = hostActionPending === visitor.id;
  const time = new Date(visitor.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const checkInTime = visitor.checkInTime ? new Date(visitor.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const handleAction = () => {
    if (visitor.status === 'APPROVED') {
      if (visitor.requiresOtp) {
        // OTP handled by parent via modal
        onCheckIn(visitor.id);
      } else {
        onCheckIn(visitor.id);
      }
    } else if (visitor.status === 'CHECKED_IN') {
      if (visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType) {
        onHandoff(visitor);
      } else {
        onCheckOut(visitor.id);
      }
    }
  };

  return (
    <View style={styles.card}>
      {/* Status indicator bar */}
      <View style={[styles.statusBar, { backgroundColor: meta.dot }]} />

      <View style={styles.content}>
        {/* Header: Type icon + Name + Status */}
        <View style={styles.headerRow}>
          <View style={[styles.typeIcon, { backgroundColor: typeMeta.bg }]}>
            <Feather name={typeMeta.icon} size={18} color={typeMeta.color} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.visitorName} numberOfLines={1}>{name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{typeMeta.label}</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{hostLabel ? `Host ${hostLabel}` : `Unit ${unitLabel}`}</Text>
              {visitor.vehicleNumber && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{visitor.vehicleNumber}</Text>
                </>
              )}
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{time}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
            <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
          </View>
        </View>

        {/* Pre-approved badge */}
        {visitor.isPreApproved && visitor.status !== 'PENDING' && (
          <View style={styles.preApprovedBadge}>
            <Feather name="shield" size={10} color="#059669" />
            <Text style={styles.preApprovedText}>Pre-approved</Text>
          </View>
        )}

        {/* Check-in time for checked-in visitors */}
        {visitor.status === 'CHECKED_IN' && checkInTime && (
          <View style={styles.checkInTimeRow}>
            <Feather name="clock" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.checkInTimeText}>Inside since {checkInTime}</Text>
          </View>
        )}

        {/* Action area */}
        <View style={styles.actionArea}>
          {visitor.status === 'PENDING' && (
            onApprove && onReject && visitor.hostUserId ? (
              <View style={styles.hostActionGroup}>
                <Text style={styles.hostActionHint}>Manager confirmation required</Text>
                <View style={styles.hostActionRow}>
                  <Button label="Decline" variant="outline" size="sm" onPress={() => onReject(visitor)} disabled={isHostActionPending} style={styles.hostActionBtn} />
                  <Button label={isHostActionPending ? 'Saving...' : 'Approve entry'} variant="primary" size="sm" onPress={() => onApprove(visitor)} disabled={isHostActionPending} loading={isHostActionPending} style={styles.hostActionBtn} />
                </View>
              </View>
            ) : (
              <View style={styles.pendingNotice}>
                <Feather name={meta.icon} size={14} color={meta.text} />
                <Text style={[styles.pendingText, { color: meta.text }]}>{meta.label}</Text>
              </View>
            )
          )}

          {visitor.status === 'APPROVED' && (
            <View style={styles.actionRow}>
              {visitor.requiresOtp ? (
                <View style={styles.otpAction}>
                  <Text style={styles.otpPrompt}>Requires OTP verification</Text>
                  <Button
                    label={isCheckingIn ? 'Verifying...' : 'Verify OTP & Check In'}
                    variant="primary"
                    size="sm"
                    icon="check"
                    onPress={handleAction}
                    disabled={isCheckingIn}
                    loading={isCheckingIn}
                    style={styles.mainActionBtn}
                  />
                </View>
              ) : (
                <Button
                  label={isCheckingIn ? 'Checking in...' : 'Confirm Entry'}
                  variant="primary"
                  size="sm"
                  icon="check"
                  onPress={handleAction}
                  disabled={isCheckingIn}
                  loading={isCheckingIn}
                  style={styles.mainActionBtn}
                />
              )}
            </View>
          )}

          {visitor.status === 'CHECKED_IN' && (
            <View style={styles.actionRow}>
              {visitor.visitorType === 'DELIVERY' && !visitor.handoffRecipientType ? (
                <Button
                  label={isCheckingOut ? 'Recording...' : 'Record Handoff & Exit'}
                  variant="primary"
                  size="sm"
                  icon="package"
                  onPress={handleAction}
                  disabled={isCheckingOut}
                  loading={isCheckingOut}
                  style={styles.mainActionBtn}
                />
              ) : (
                <Button
                  label={isCheckingOut ? 'Checking out...' : 'Check Out'}
                  variant="secondary"
                  size="sm"
                  icon="log-out"
                  onPress={handleAction}
                  disabled={isCheckingOut}
                  loading={isCheckingOut}
                  style={styles.mainActionBtn}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  statusBar: {
    height: 4,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  visitorName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaDot: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#D1D5DB',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 98,
    gap: 6,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  preApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
    alignSelf: 'flex-start',
  },
  preApprovedText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#059669',
    letterSpacing: 0.3,
  },
  checkInTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  checkInTimeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#1D4ED8',
  },
  actionArea: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  hostActionGroup: { gap: 10 },
  hostActionHint: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#9A3412' },
  hostActionRow: { flexDirection: 'row', gap: 8 },
  hostActionBtn: { flex: 1 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  otpAction: {
    gap: 8,
    width: '100%',
  },
  otpPrompt: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  mainActionBtn: {
    minWidth: 160,
  },
});
