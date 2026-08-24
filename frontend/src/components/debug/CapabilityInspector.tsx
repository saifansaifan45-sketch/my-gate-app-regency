import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { useSession } from '../../store/auth';

export function CapabilityInspector() {
  // Only render in development mode
  if (!__DEV__) return null;

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

  const [isOpen, setIsOpen] = useState(false);

  const capabilities = [
    { label: 'Leadership Access', value: hasLeadershipAccess() },
    { label: 'Manager Access', value: hasManagerAccess() },
    { label: 'Workforce Access', value: hasWorkforceAccess() },
    { label: 'Resident Access', value: hasResidentAccess() },
    { label: 'Owner Access', value: hasOwnerAccess() },
    { label: 'Pending Approval', value: isPendingApproval() },
    { label: 'Onboarded', value: isOnboarded() },
  ];

  return (
    <>
      <TouchableOpacity
        style={styles.floatingBadge}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
      >
        <Feather name="shield" size={14} color="#FFFFFF" />
        <Text style={styles.badgeText}>DEV ROLES</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Feather name="cpu" size={20} color="#143D2A" />
                <Text style={styles.cardTitle}>Capability Inspector</Text>
              </View>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Identity</Text>
              <Text style={styles.userText}>
                {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Anonymous'} ({user?.email || 'No email'})
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Memberships (DB Verified)</Text>
              {user?.memberships && user.memberships.length > 0 ? (
                user.memberships.map((m, idx) => (
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
                ))
              ) : (
                <Text style={styles.emptyText}>None</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ownerships</Text>
              {user?.ownerships && user.ownerships.length > 0 ? (
                user.ownerships.map((o, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemRole}>Unit {o.unitNumber || o.unitId}</Text>
                    <Text style={[styles.statusBadge, styles.statusApproved]}>{o.status}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>None</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Residencies</Text>
              {user?.residencies && user.residencies.length > 0 ? (
                user.residencies.map((r, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemRole}>Unit {r.unitNumber || r.unitId} ({r.relationshipType})</Text>
                    <Text style={[styles.statusBadge, styles.statusApproved]}>{r.status}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>None</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resolved Capabilities</Text>
              <View style={styles.capGrid}>
                {capabilities.map((cap, idx) => (
                  <View key={idx} style={styles.capItem}>
                    <Feather
                      name={cap.value ? 'check-circle' : 'x-circle'}
                      size={16}
                      color={cap.value ? '#10B981' : '#9CA3AF'}
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
}

const styles = StyleSheet.create({
  floatingBadge: {
    position: 'absolute',
    bottom: 80,
    right: 14,
    backgroundColor: '#143D2A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 98,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#143D2A',
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 6,
  },
  userText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1F2937',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemRole: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#374151',
  },
  statusBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  capGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  capItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  capText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#9CA3AF',
  },
  capTextActive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111827',
  },
});
