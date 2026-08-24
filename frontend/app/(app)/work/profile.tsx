import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { theme } from '../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/api/client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../../src/store/auth';
import { getPersonnelRoleLabel } from '../../../src/utils/personnel';
import { ConfirmationModal } from '../../../src/components/ui/ConfirmationModal';

type Availability = 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'OFF_DUTY', label: 'Off Duty' },
];

export default function WorkProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, user } = useSession();
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
  });

  const handleSetAvailability = async (status: Availability) => {
    setUpdatingAvailability(true);
    try {
      await api.patch('/work/availability', { availabilityStatus: status });
      await queryClient.invalidateQueries({ queryKey: ['workforce-dashboard'] });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const personnel = data?.personnelProfile;
  const todayAttendance = data?.todayAttendance;
  const isSecurity = personnel?.category?.toUpperCase() === 'SECURITY';

  const requestLogout = () => {
    if (!isLoggingOut) setIsLogoutConfirmVisible(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmVisible(false);
    }
  };

  const formatTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Identity Card */}
            <View style={styles.identityCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{personnel?.name?.charAt(0) || user?.firstName?.charAt(0) || 'W'}</Text>
              </View>
              <Text style={styles.name}>{personnel?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Team Member'}</Text>
              <Text style={styles.email}>{user?.email || personnel?.phone || ''}</Text>

              <View style={styles.rolePill}>
                <Ionicons name="briefcase-outline" size={13} color={theme.colors.primary} />
                <Text style={styles.rolePillText}>
                  {getPersonnelRoleLabel(personnel)}
                </Text>
              </View>
            </View>

            {/* Duty Status */}
            {!isSecurity && <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duty Status</Text>
              <View style={styles.card}>
                <View style={styles.availabilityRow}>
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const active = personnel?.availabilityStatus === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.availOption, active && styles.availOptionActive]}
                        disabled={updatingAvailability}
                        onPress={() => handleSetAvailability(opt.value)}
                      >
                        <Text style={[styles.availOptionText, active && styles.availOptionTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>}

            {/* Today's Attendance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Attendance</Text>
              <View style={styles.attCard}>
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>Check In</Text>
                  <Text style={styles.attValue}>{formatTime(todayAttendance?.checkIn) || '—'}</Text>
                </View>
                <View style={styles.attDivider} />
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>Check Out</Text>
                  <Text style={styles.attValue}>{formatTime(todayAttendance?.checkOut) || '—'}</Text>
                </View>
              </View>
            </View>

            {/* Links */}
            {!isSecurity && <View style={styles.section}>
              <Text style={styles.sectionTitle}>Work</Text>
              <View style={styles.linksCard}>
                <Pressable style={styles.linkRow} onPress={() => router.push('/work/tasks/history')}>
                  <View style={[styles.linkIcon, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkTitle}>Task History</Text>
                    <Text style={styles.linkDesc}>Completed tasks & work notes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>}

            {/* Account */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Pressable
                style={[styles.logoutButton, isLoggingOut && { opacity: 0.6 }]}
                onPress={requestLogout}
                disabled={isLoggingOut}
                accessibilityRole="button"
                accessibilityLabel="Log out"
                accessibilityState={{ disabled: isLoggingOut }}
              >
                {isLoggingOut ? <ActivityIndicator size="small" color="#EF4444" /> : <Ionicons name="log-out-outline" size={22} color="#EF4444" />}
                <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out…' : 'Log Out'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <ConfirmationModal
        visible={isLogoutConfirmVisible}
        onClose={() => setIsLogoutConfirmVisible(false)}
        onConfirm={handleLogout}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        variant="danger"
        confirmIcon="log-out"
        loading={isLoggingOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    color: '#059669',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  name: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 98,
  },
  rolePillText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  availOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  availOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  availOptionText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#374151',
  },
  availOptionTextActive: {
    color: '#fff',
  },
  attCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
  },
  attItem: {
    flex: 1,
    alignItems: 'center',
  },
  attDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  attLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
    marginBottom: 4,
  },
  attValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  linksCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 2,
  },
  linkDesc: {
    fontSize: 12.5,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginLeft: 8,
  },
});
