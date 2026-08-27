/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useState } from 'react';
import { View, StyleSheet, Image, Modal, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { TimePeriod, getTimeGreeting } from './TimeBasedBackground';
import { useSession } from '../../store/auth';

interface HeroHeaderProps {
  displayName: string;
  period: TimePeriod;
  topInset: number;
  onNotificationPress: () => void;
  onProfilePress: () => void;
}

import { useResponsive } from '../../hooks/useResponsive';

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  displayName,
  period,
  topInset,
  onNotificationPress,
  onProfilePress,
}) => {
  const greeting = getTimeGreeting(period);
  const avatarLetter = (displayName.charAt(0) || 'R').toUpperCase();
  const [rolesOpen, setRolesOpen] = useState(false);
  const { pagePadding } = useResponsive();

  const {
    user,
    hasLeadershipAccess,
    hasManagerAccess,
    hasWorkforceAccess,
    hasResidentAccess,
    hasOwnerAccess,
    isPendingApproval,
    isOnboarded,
  } = useSession();

  const activeRoles: string[] = [];
  if (hasLeadershipAccess()) activeRoles.push('Leadership');
  if (hasManagerAccess()) activeRoles.push('Manager');
  if (hasWorkforceAccess()) activeRoles.push('Workforce');
  if (hasResidentAccess()) activeRoles.push('Resident');
  if (hasOwnerAccess()) activeRoles.push('Owner');

  const capabilities = [
    { label: 'Leadership', value: hasLeadershipAccess() },
    { label: 'Manager', value: hasManagerAccess() },
    { label: 'Workforce', value: hasWorkforceAccess() },
    { label: 'Resident', value: hasResidentAccess() },
    { label: 'Owner', value: hasOwnerAccess() },
    { label: 'Pending Approval', value: isPendingApproval() },
    { label: 'Onboarded', value: isOnboarded() },
  ];

  return (
    <>
      <View style={[styles.container, { paddingHorizontal: pagePadding, paddingTop: Math.max(topInset + 6, 22) }]}>
        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/regency-salma-typographic-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.topRightColumn}>
            <View style={styles.topRightActions}>
              <PremiumPressable
                style={styles.bellButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={onNotificationPress}
                scaleTo={0.92}
                accessibilityLabel="Notifications"
              >
                <Feather name="bell" size={20} color="#111827" />
                <View style={styles.unreadDot} />
              </PremiumPressable>

              <PremiumPressable
                style={styles.avatarButton}
                onPress={onProfilePress}
                scaleTo={0.92}
                accessibilityLabel="Profile"
              >
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </PremiumPressable>
            </View>

            <TouchableOpacity
              style={styles.rolesBadge}
              onPress={() => setRolesOpen(true)}
              activeOpacity={0.7}
            >
              <Feather name="shield" size={11} color="#FFFFFF" />
              <Text style={styles.rolesBadgeText}>Roles</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <View style={styles.greetingBadge}>
            <Text style={styles.greetingSubtitle}>{greeting}</Text>
          </View>
          <Text style={styles.residentName}>{displayName}</Text>
          <Text style={styles.supportingCopy}>
            Welcome back. Here&apos;s what&apos;s happening in your community.
          </Text>
        </View>
      </View>

      <Modal
        visible={rolesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRolesOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Feather name="shield" size={18} color="#143D2A" />
                <Text style={styles.cardTitle}>Your Roles</Text>
              </View>
              <TouchableOpacity onPress={() => setRolesOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Text style={styles.userText}>
                {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Anonymous'}
              </Text>
            </View>

            {user?.memberships && user.memberships.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Memberships</Text>
                {user.memberships.map((m, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemRole}>{m.role}</Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        m.status === 'APPROVED' ? styles.statusApproved : styles.statusPending,
                      ]}
                    >
                      {m.status}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {user?.residencies && user.residencies.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Residencies</Text>
                {user.residencies.map((r, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemRole}>Unit {r.unitNumber || r.unitId}</Text>
                    <Text style={[styles.statusBadge, styles.statusApproved]}>{r.status}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Capabilities</Text>
              <View style={styles.capGrid}>
                {capabilities.map((cap, idx) => (
                  <View key={idx} style={styles.capItem}>
                    <Feather
                      name={cap.value ? 'check-circle' : 'x-circle'}
                      size={14}
                      color={cap.value ? '#10B981' : '#D1D5DB'}
                    />
                    <Text style={[styles.capText, cap.value && styles.capTextActive]}>
                      {cap.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  topRightColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: '#C98B45',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#143D2A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  rolesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 98,
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  rolesBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  greetingSection: {
    maxWidth: 320,
    marginBottom: 6,
  },
  greetingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 98,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#0B2118',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  greetingSubtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  residentName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: -0.7,
    textShadowColor: 'rgba(11, 31, 22, 0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  supportingCopy: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: -0.1,
    marginTop: 6,
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#143D2A',
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  userText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#1F2937',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemRole: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#374151',
  },
  statusBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusApproved: {
    backgroundColor: '#ECFDF5',
    color: '#047857',
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
    color: '#B45309',
  },
  capGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  capItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: '47%',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
  },
  capText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#D1D5DB',
  },
  capTextActive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111827',
  },
});
