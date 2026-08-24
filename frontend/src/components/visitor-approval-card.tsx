import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { PremiumPressable } from './ui/PremiumPressable';
import { Button } from './ui/Button';
import { theme } from '../theme';
import { homeLayout, homeSurface } from './home/homeSurface';

export interface VisitorApproval {
  id: string;
  name: string;
  type: string;
  time: string;
  otp?: string;
}

type CardStatus = 'pending' | 'approved' | 'rejected';

interface VisitorApprovalCardProps {
  visitor: VisitorApproval;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPress?: (id: string) => void;
}

export function VisitorApprovalCard({ visitor, onApprove, onReject, onDelete, onPress }: VisitorApprovalCardProps) {
  const [status, setStatus] = useState<CardStatus>('pending');

  const handleApprove = () => {
    setStatus('approved');
    onApprove?.(visitor.id);
  };

  const handleReject = () => {
    setStatus('rejected');
    onReject?.(visitor.id);
  };

  const handleUndo = () => {
    setStatus('pending');
  };

  if (status === 'approved') {
    return (
      <PremiumPressable style={[styles.card, styles.cardApproved]} onPress={() => onPress?.(visitor.id)} scaleTo={0.99}>
        <View style={styles.topRow}>
          <View style={[styles.avatar, styles.avatarApproved]}>
            <Feather name="check" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>Guest approved</Text>
            <Text style={styles.meta}>{visitor.name} is on their way</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {visitor.otp && (
          <View style={styles.otpRow}>
            <Text style={styles.otpLabel}>Share OTP with your guest</Text>
            <View style={styles.otpPill}>
              <Text style={styles.otpCode}>{visitor.otp}</Text>
              <Feather name="copy" size={14} color={theme.colors.primary} />
            </View>
          </View>
        )}
        {!visitor.otp && (
          <View style={styles.otpRow}>
            <Text style={styles.otpLabel}>Gate check-in approved</Text>
          </View>
        )}
      </PremiumPressable>
    );
  }

  if (status === 'rejected') {
    return (
      <View style={[styles.card, styles.cardRejected]}>
        <View style={styles.topRow}>
          <View style={[styles.avatar, styles.avatarRejected]}>
            <Feather name="x" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>Request declined</Text>
            <Text style={styles.meta}>{visitor.name} has been turned away</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <Button label="Undo" variant="secondary" icon="rotate-ccw" onPress={handleUndo} size="md" style={styles.actionButton} />
          <Button label="Delete" variant="dangerOutline" icon="trash-2" onPress={() => onDelete?.(visitor.id)} size="md" style={styles.actionButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{visitor.name.charAt(0)}</Text>
          <View style={styles.liveDot} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{visitor.name}</Text>
          <Text style={styles.meta}>{visitor.type} · {visitor.time}</Text>
        </View>
        <View style={styles.atGatePill}>
          <View style={styles.pulseDot} />
          <Text style={styles.atGateText}>At gate</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Button label="Reject" variant="dangerOutline" icon="x" onPress={handleReject} size="md" style={styles.actionButton} />
        <Button label="Approve" variant="primary" icon="check" onPress={handleApprove} size="md" style={styles.actionButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...homeSurface,
    padding: homeLayout.cardPadding,
    marginBottom: 20,
  },
  cardApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  cardRejected: {
    backgroundColor: '#FEF7F7',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  avatarApproved: {
    backgroundColor: theme.colors.success,
    borderColor: 'transparent',
  },
  avatarRejected: {
    backgroundColor: '#F87171',
    borderColor: 'transparent',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.colors.primary,
  },
  liveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 5,
    backgroundColor: '#FBBF24',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  meta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  atGatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 98,
    gap: 6,
    marginLeft: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#D97706',
  },
  atGateText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#B45309',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otpLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  otpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.1)',
  },
  otpCode: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: 1,
    color: theme.colors.primary,
  },
});
