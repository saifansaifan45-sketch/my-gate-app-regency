/* eslint-disable @typescript-eslint/no-require-imports */
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, StyleSheet, ScrollView, Image, RefreshControl } from 'react-native';
import { getTimePeriod, TimePeriod } from '../../src/components/home/TimeBasedBackground';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useSession } from '../../src/store/auth';
import { theme } from '../../src/theme';
import { homeLayout, homeSurface } from '../../src/components/home/homeSurface';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { householdApi } from '../../src/api/household';
import { propertiesApi, UnitResidencyRecord } from '../../src/api/properties';

const RELATIONSHIP_COLORS: Record<string, { bg: string; text: string }> = {
  OWNER: { bg: '#ECFDF5', text: '#047857' },
  TENANT: { bg: '#EFF6FF', text: '#1D4ED8' },
  FAMILY_MEMBER: { bg: '#FEF3C7', text: '#92400E' },
};

function getRelationshipColor(rel: string) {
  return RELATIONSHIP_COLORS[rel] || { bg: '#F3F4F6', text: '#374151' };
}

function getInitials(first: string, last?: string) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

function residentFullName(r: UnitResidencyRecord['user']) {
  return `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Resident';
}

const PERIOD_IMAGES: Record<TimePeriod, ReturnType<typeof require>> = {
  morning: require('../../assets/morning.webp'),
  afternoon: require('../../assets/afternoon.webp'),
  evening: require('../../assets/evening.webp'),
  night: require('../../assets/night.webp'),
};

export default function MyHomeScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { user, primaryResidency } = useSession() || {};

  const unitNumber = primaryResidency?.unitNumber || user?.unitNumber || '9A';
  const unitId = primaryResidency?.unitId;

  const { data: residencyData, isLoading: residenciesLoading, isRefetching: residenciesRefetching, refetch: refetchResidencies } = useQuery({
    queryKey: ['unit-residencies', unitId],
    queryFn: () => propertiesApi.getUnitResidencies(unitId!),
    enabled: !!unitId,
    refetchOnMount: 'always',
  });

  const { data: householdData, isLoading: householdLoading, isRefetching: householdRefetching, refetch: refetchHousehold } = useQuery({
    queryKey: ['household-records'],
    queryFn: householdApi.getRecords,
    refetchOnMount: 'always',
  });

  const isRefreshing = residenciesRefetching || householdRefetching;
  const isLoading = residenciesLoading || householdLoading;

  const verifiedResidents = residencyData?.residencies.filter((residency) => residency.status === 'ACTIVE') || [];
  const householdMembers = householdData?.members || [];
  const vehicles = householdData?.vehicles || [];
  const pets = householdData?.pets || [];
  const currentPeriod: TimePeriod = getTimePeriod();

  const onRefresh = () => {
    refetchResidencies();
    refetchHousehold();
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title={`Unit ${unitNumber}`}
        rightAction={
          <PremiumPressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => router.push('/profile-settings')}
            style={styles.settingsBtn}
          >
            <Feather name="settings" size={18} color={theme.colors.textSecondary} />
          </PremiumPressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Hero */}
        <ScreenEntrance>
          <View style={styles.heroContainer}>
            <Image
              source={PERIOD_IMAGES[currentPeriod]}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroGradient} />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Feather name="home" size={12} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>My Residence</Text>
              </View>
              <Text style={styles.heroUnit}>{unitNumber}</Text>
              <Text style={styles.heroAddress}>Regency Salma Township</Text>
            </View>
          </View>
        </ScreenEntrance>

        {/* Verified Residents (from unit residencies) */}
        <ScreenEntrance delay={60}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={homeLayout.sectionTitle}>Registered Residents</Text>
              {!isLoading && <Text style={styles.countBadge}>{verifiedResidents.length}</Text>}
            </View>
            <View style={homeLayout.headingSpacingSpacer} />

            <View style={homeSurface}>
              {isLoading ? (
                <View style={styles.listPad}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.skeletonRow}>
                      <Skeleton width={42} height={42} style={{ borderRadius: 14 }} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="60%" height={14} style={{ borderRadius: 4 }} />
                        <Skeleton width="40%" height={11} style={{ borderRadius: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : verifiedResidents.length === 0 ? (
                <EmptyState icon="users" title="No residents" description="No verified residents for this unit." />
              ) : (
                verifiedResidents.map((res, index) => {
                  const relColor = getRelationshipColor(res.relationshipType);
                  const isMe = res.userId === user?.id;
                  return (
                    <React.Fragment key={res.id}>
                      <PremiumPressable
                        style={styles.recordRow}
                        onPress={() => router.push('/family-members')}
                        scaleTo={0.98}
                      >
                        <View style={[styles.avatar, isMe && styles.avatarPrimary]}>
                          <Text style={[styles.avatarText, isMe && styles.avatarTextPrimary]}>
                            {getInitials(res.user.firstName, res.user.lastName)}
                          </Text>
                        </View>
                        <View style={styles.recordInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.recordTitle} numberOfLines={1}>
                              {residentFullName(res.user)}
                            </Text>
                            {isMe && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>You</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.relPill, { backgroundColor: relColor.bg }]}>
                            <Text style={[styles.relPillText, { color: relColor.text }]}>
                              {res.relationshipType.replace('_', ' ')}
                            </Text>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
                      </PremiumPressable>
                      {index < verifiedResidents.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  );
                })
              )}
            </View>

            <PremiumPressable
              style={styles.manageLink}
              onPress={() => router.push('/family-members')}
              scaleTo={0.97}
            >
              <Feather name="users" size={15} color={theme.colors.primary} />
              <Text style={styles.manageLinkText}>Manage household members</Text>
              <Feather name="arrow-right" size={13} color={theme.colors.primary} />
            </PremiumPressable>
          </View>
        </ScreenEntrance>

        {/* Household Members (added by owner) */}
        {householdMembers.length > 0 && (
          <ScreenEntrance delay={80}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={homeLayout.sectionTitle}>Family & Dependents</Text>
                <Text style={styles.countBadge}>{householdMembers.length}</Text>
              </View>
              <View style={homeLayout.headingSpacingSpacer} />

              <View style={homeSurface}>
                {householdMembers.map((m, index) => (
                  <React.Fragment key={m.id}>
                    <View style={styles.recordRow}>
                      <View style={styles.recordIconBox}>
                        <Feather name="user" size={18} color={theme.colors.primary} />
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordTitle}>{m.name}</Text>
                        <Text style={styles.recordDetail}>{m.relationship}</Text>
                      </View>
                    </View>
                    {index < householdMembers.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </ScreenEntrance>
        )}

        {/* Vehicles */}
        <ScreenEntrance delay={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={homeLayout.sectionTitle}>Vehicles</Text>
              {vehicles.length > 0 && <Text style={styles.countBadge}>{vehicles.length}</Text>}
            </View>
            <View style={homeLayout.headingSpacingSpacer} />

            <View style={homeSurface}>
              {isLoading ? (
                <View style={styles.listPad}>
                  {[1, 2].map((i) => (
                    <View key={i} style={styles.skeletonRow}>
                      <Skeleton width={42} height={42} style={{ borderRadius: 14 }} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="50%" height={14} style={{ borderRadius: 4 }} />
                        <Skeleton width="70%" height={11} style={{ borderRadius: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : vehicles.length === 0 ? (
                <View style={styles.emptyRow}>
                  <View style={[styles.recordIconBox, { backgroundColor: '#FFF3D6' }]}>
                    <Feather name="truck" size={18} color="#D97706" />
                  </View>
                  <Text style={styles.emptyText}>No vehicles registered</Text>
                </View>
              ) : (
                vehicles.map((v, index) => (
                  <React.Fragment key={v.id}>
                    <View style={styles.recordRow}>
                      <View style={[styles.recordIconBox, { backgroundColor: '#FFF3D6' }]}>
                        <Feather name="truck" size={18} color="#D97706" />
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordTitle}>{v.registrationNumber}</Text>
                        <Text style={styles.recordDetail}>
                          {[v.make, v.model, v.color].filter(Boolean).join(' · ') || 'Vehicle'}
                        </Text>
                      </View>
                    </View>
                    {index < vehicles.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))
              )}
            </View>
          </View>
        </ScreenEntrance>

        {/* Pets */}
        <ScreenEntrance delay={140}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={homeLayout.sectionTitle}>Pets</Text>
              {pets.length > 0 && <Text style={styles.countBadge}>{pets.length}</Text>}
            </View>
            <View style={homeLayout.headingSpacingSpacer} />

            <View style={homeSurface}>
              {isLoading ? (
                <View style={styles.listPad}>
                  {[1, 2].map((i) => (
                    <View key={i} style={styles.skeletonRow}>
                      <Skeleton width={42} height={42} style={{ borderRadius: 14 }} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="40%" height={14} style={{ borderRadius: 4 }} />
                        <Skeleton width="60%" height={11} style={{ borderRadius: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : pets.length === 0 ? (
                <View style={styles.emptyRow}>
                  <View style={[styles.recordIconBox, { backgroundColor: '#FCE7F3' }]}>
                    <Feather name="heart" size={18} color="#BE185D" />
                  </View>
                  <Text style={styles.emptyText}>No pets registered</Text>
                </View>
              ) : (
                pets.map((p, index) => (
                  <React.Fragment key={p.id}>
                    <View style={styles.recordRow}>
                      <View style={[styles.recordIconBox, { backgroundColor: '#FCE7F3' }]}>
                        <Feather name="heart" size={18} color="#BE185D" />
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordTitle}>{p.name}</Text>
                        <Text style={styles.recordDetail}>
                          {[p.species, p.breed, p.color].filter(Boolean).join(' · ') || 'Pet'}
                        </Text>
                      </View>
                    </View>
                    {index < pets.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))
              )}
            </View>
          </View>
        </ScreenEntrance>

        {/* Unit Details */}
        <ScreenEntrance delay={180}>
          <View style={styles.section}>
            <Text style={homeLayout.sectionTitle}>Unit Details</Text>
            <View style={[homeSurface, { marginTop: homeLayout.headingSpacing }]}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Feather name="home" size={16} color={theme.colors.primary} />
                </View>
                <Text style={styles.detailLabel}>Apartment / Unit</Text>
                <Text style={styles.detailValue}>{unitNumber}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Feather name="map-pin" size={16} color={theme.colors.primary} />
                </View>
                <Text style={styles.detailLabel}>Township</Text>
                <Text style={styles.detailValue}>Regency Salma</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Feather name="check-circle" size={16} color="#047857" />
                </View>
                <Text style={styles.detailLabel}>Account Status</Text>
                <Text style={[styles.detailValue, { color: '#047857' }]}>Active</Text>
              </View>
            </View>
          </View>
        </ScreenEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  content: { paddingTop: 4 },

  /* Hero */
  heroContainer: {
    aspectRatio: 2.4,
    minHeight: 160,
    borderRadius: cardSystem.radius,
    marginHorizontal: cardSystem.pagePadding,
    marginBottom: cardSystem.sectionSpacing,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: cardSystem.padding,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroContent: { zIndex: 1 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 98,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroUnit: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 36,
    lineHeight: 44,
    color: '#FFF',
    letterSpacing: -0.8,
    includeFontPadding: false,
    paddingBottom: 2,
    marginBottom: 2,
  },
  heroAddress: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },

  /* Sections */
  section: {
    marginBottom: cardSystem.sectionSpacing,
    paddingHorizontal: cardSystem.pagePadding,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 98,
  },

  /* Record rows */
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPrimary: {
    backgroundColor: theme.colors.primary,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  avatarTextPrimary: {
    color: '#FFFFFF',
  },
  recordIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  recordDetail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  youBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 98,
  },
  youBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  relPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  relPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 15 },

  /* Empty state */
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  /* Manage link */
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  manageLinkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.primary,
  },

  /* Details */
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },

  /* Skeleton */
  listPad: { padding: 15 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
});
