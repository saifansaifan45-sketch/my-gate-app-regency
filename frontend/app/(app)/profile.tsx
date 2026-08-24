import React, { useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { ConfirmationModal } from '../../src/components/ui/ConfirmationModal';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { homeLayout, homeSurface } from '../../src/components/home/homeSurface';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { useSession } from '../../src/store/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(true);
  const { user, logout, hasManagerAccess, hasOwnership } = useSession();
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = `${user?.firstName || 'Resident'} ${user?.lastName || ''}`.trim();
  const ownedUnits = user?.ownerships || [];
  const residencies = user?.residencies || [];
  const primaryResidency = residencies.find((r) => r.status === 'ACTIVE') || residencies[0];
  const unit = primaryResidency?.unitNumber || user?.unitNumber || ownedUnits[0]?.unitNumber || '';
  const email = user?.email || '';
  const phone = user?.phoneNumber || '';

  const isManager = hasManagerAccess();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Profile"
        rightAction={
          <PremiumPressable
            onPress={() => router.push('/(app)/profile-settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.settingsIconBtn}
          >
            <Feather name="settings" size={22} color={theme.colors.textPrimary} />
          </PremiumPressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <ScreenEntrance delay={50}>
          <View style={styles.profileCard}>
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=143D2A&color=fff&size=128` }}
              style={styles.avatar}
            />
            <Text style={styles.profileName}>{displayName}</Text>

            <View style={styles.badgeRow}>
              {primaryResidency ? (
                <View style={[styles.roleBadge, primaryResidency.status === 'PENDING' && { backgroundColor: '#FFF7ED' }]}>
                  <Text style={[styles.roleBadgeText, primaryResidency.status === 'PENDING' && { color: '#C2410C' }]}>
                    {primaryResidency.relationshipType} · {primaryResidency.status}
                  </Text>
                </View>
              ) : null}
              {unit ? (
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>Unit {unit}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.profileContact}>
              {email}
            </Text>
            {phone ? (
              <Text style={styles.profilePhone}>{phone}</Text>
            ) : (
              <Text style={styles.profilePhoneEmpty}>Phone number not added</Text>
            )}
          </View>
        </ScreenEntrance>

        {/* Current Residence Status */}
        <ScreenEntrance delay={80}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Residence</Text>
            <View style={styles.card}>
              {primaryResidency ? (
                <View style={styles.menuRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                    <Feather name="home" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Unit {primaryResidency.unitNumber || unit}</Text>
                    <Text style={styles.menuDesc}>
                      Relationship: {primaryResidency.relationshipType} ({primaryResidency.status.toLowerCase()})
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      primaryResidency.status === 'ACTIVE' ? styles.statusActive : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        primaryResidency.status === 'ACTIVE' ? styles.statusActiveText : styles.statusPendingText,
                      ]}
                    >
                      {primaryResidency.status}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyRow}>
                  <Feather name="info" size={18} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyText}>You are not currently linked to an active residence.</Text>
                </View>
              )}
            </View>
          </View>
        </ScreenEntrance>

        {/* Ownership Section */}
        {hasOwnership() ? (
          <ScreenEntrance delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Properties Owned</Text>
              <View style={styles.card}>
                {ownedUnits.map((o, idx) => (
                  <React.Fragment key={o.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <PremiumPressable
                      style={styles.menuRow}
                      onPress={() => router.push('/(app)/residency-requests')}
                    >
                      <View style={[styles.iconBox, { backgroundColor: '#F3F8F5' }]}>
                        <Feather name="key" size={20} color={theme.colors.primary} />
                      </View>
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuLabel}>Unit {o.unitNumber || unit}</Text>
                        <Text style={styles.menuDesc}>Property Title: Active • Manage Residencies</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                    </PremiumPressable>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </ScreenEntrance>
        ) : null}

        {/* Manager Operations Module (If user has community role) */}
        {isManager ? (
          <ScreenEntrance delay={120}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Community Operational Roles</Text>
              <View style={styles.card}>
                <PremiumPressable style={styles.menuRow} onPress={() => router.push('/manager')}>
                  <View style={[styles.iconBox, { backgroundColor: '#143D2A' }]}>
                    <MaterialCommunityIcons name="shield-account" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Manager Operations Module</Text>
                    <Text style={styles.menuDesc}>Tickets, staff assignment, attendance & tracking</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>
            </View>
          </ScreenEntrance>
        ) : null}

        {/* Visitors & Deliveries (Manager) */}
        {isManager ? (
          <ScreenEntrance delay={140}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Visitors & Deliveries</Text>
              <View style={styles.card}>
                <PremiumPressable style={styles.menuRow} onPress={() => router.push('/manager/visitors')}>
                  <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                    <Feather name="users" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Gate Visitors</Text>
                    <Text style={styles.menuDesc}>Review guest visits and call visitors</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>

                <View style={styles.divider} />

                <PremiumPressable
                  style={styles.menuRow}
                  onPress={() => router.push({ pathname: '/manager/visitors', params: { tab: 'deliveries' } })}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="package" size={20} color="#D97706" />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Delivery Orders</Text>
                    <Text style={styles.menuDesc}>Track incoming deliveries from the gate</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>
            </View>
          </ScreenEntrance>
        ) : null}

        {/* Shortcuts */}
        {!isManager ? (
          <ScreenEntrance delay={160}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Residence & Family</Text>
              <View style={styles.card}>
                <PremiumPressable style={styles.menuRow} onPress={() => router.push('/my-home')}>
                  <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                    <Feather name="home" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>My Home</Text>
                    <Text style={styles.menuDesc}>Unit {unit} • Household details</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>

                <View style={styles.divider} />

                <PremiumPressable style={styles.menuRow} onPress={() => router.push('/family-members')}>
                  <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                    <Feather name="users" size={20} color="#1976D2" />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Family Records</Text>
                    <Text style={styles.menuDesc}>Family, vehicles & pets registered to your home</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>

                <View style={styles.divider} />

                <PremiumPressable style={styles.menuRow} onPress={() => router.push('/activity-overview')}>
                  <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
                    <Feather name="activity" size={20} color="#7C3AED" />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>Household Activity</Text>
                    <Text style={styles.menuDesc}>Shared visitor, cab and delivery history</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>
            </View>
          </ScreenEntrance>
        ) : null}

        {/* Account & Logout */}
        <ScreenEntrance delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <PremiumPressable style={styles.menuRow} onPress={() => setIsLogoutConfirmVisible(true)}>
                <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                  <Feather name="log-out" size={20} color="#D32F2F" />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={[styles.menuLabel, { color: '#D32F2F' }]}>Log Out</Text>
                  <Text style={styles.menuDesc}>Sign out of your session</Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
              </PremiumPressable>
            </View>
          </View>
        </ScreenEntrance>
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
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 20,
    gap: cardSystem.sectionSpacing,
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  profileCard: {
    ...homeSurface,
    padding: homeLayout.cardPaddingLarge,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 38,
    marginBottom: 16,
  },
  profileName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 98,
  },
  roleBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  unitBadge: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unitBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  profileContact: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textSecondary,
  },
  profilePhone: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  profilePhoneEmpty: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  section: {
    gap: cardSystem.headingSpacing,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  card: {
    ...homeSurface,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: cardSystem.actionHeight,
    paddingHorizontal: cardSystem.padding,
    paddingVertical: 16,
    gap: 14,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: cardSystem.actionHeight,
    padding: cardSystem.padding,
    gap: 14,
  },
  emptyText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  iconBox: {
    width: homeLayout.iconBox,
    height: homeLayout.iconBox,
    borderRadius: homeLayout.iconRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuLabel: {
    ...cardSystem.title,
    marginBottom: 3,
  },
  menuDesc: {
    ...cardSystem.description,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: cardSystem.padding,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
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
});
