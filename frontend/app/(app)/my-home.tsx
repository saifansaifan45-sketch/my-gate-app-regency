/* eslint-disable @typescript-eslint/no-require-imports */
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, RefreshControl } from 'react-native';
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
import { homeLayout } from '../../src/components/home/homeSurface';
import { householdApi, HouseholdMemberRecord } from '../../src/api/household';

const RELATIONSHIP_COLORS: Record<string, { bg: string; text: string }> = {
  OWNER: { bg: '#ECFDF5', text: '#047857' },
  TENANT: { bg: '#EFF6FF', text: '#1D4ED8' },
  FAMILY_MEMBER: { bg: '#FEF3C7', text: '#92400E' },
  SPOUSE: { bg: '#F3E8FF', text: '#6B21A8' },
  PARENT: { bg: '#FDF2F8', text: '#9D174D' },
  CHILD: { bg: '#E0F2FE', text: '#0369A1' },
  SIBLING: { bg: '#F0FDF4', text: '#166534' },
};

function getRelationshipColor(rel: string) {
  const key = rel?.toUpperCase().replace(/\s+/g, '_');
  return RELATIONSHIP_COLORS[key] || { bg: '#F3F4F6', text: '#374151' };
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function MyHomeScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { user, primaryResidency, hasOwnership } = useSession() || {};

  const displayName = `${user?.firstName || 'Resident'} ${user?.lastName || ''}`.trim();
  const unitNumber = primaryResidency?.unitNumber || user?.unitNumber || '9A';
  const relationshipLabel = primaryResidency?.relationshipType
    ? primaryResidency.relationshipType === 'OWNER'
      ? 'Owner'
      : primaryResidency.relationshipType === 'TENANT'
      ? 'Tenant'
      : 'Family Member'
    : hasOwnership?.()
    ? 'Owner'
    : 'Resident';

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['household-records'],
    queryFn: householdApi.getRecords,
    staleTime: 30_000,
  });

  const allResidents = useMemo(() => {
    const primary = {
      id: user?.id || 'primary',
      name: displayName,
      relationship: relationshipLabel,
      isPrimary: true,
    };
    const household = (data?.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      relationship: m.relationship,
      isPrimary: false,
    }));
    return [primary, ...household];
  }, [data?.members, displayName, relationshipLabel, user?.id]);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title={`Unit ${unitNumber}`}
        rightAction={
          <PremiumPressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => router.push('/profile-settings')}
            style={styles.headerIconBtn}
          >
            <Feather name="settings" size={18} color={theme.colors.textSecondary} />
          </PremiumPressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {/* Hero */}
        <ScreenEntrance>
          <View style={styles.heroContainer}>
            <Image
              source={require('../../assets/hero-image.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Feather name="home" size={13} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>My Residence</Text>
              </View>
              <Text style={styles.unitNumber}>{unitNumber}</Text>
              <Text style={styles.unitAddress}>Regency Salma Township</Text>
            </View>
          </View>
        </ScreenEntrance>

        {/* Registered Residents */}
        <ScreenEntrance delay={80}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registered Residents</Text>
              <Text style={styles.sectionCount}>{allResidents.length}</Text>
            </View>

            <View style={styles.card}>
              {isLoading ? (
                <View style={styles.skeletonWrap}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.skeletonRow}>
                      <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="60%" height={14} style={{ borderRadius: 4 }} />
                        <Skeleton width="40%" height={11} style={{ borderRadius: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : allResidents.length === 0 ? (
                <EmptyState icon="users" title="No residents" description="No residents registered for this unit." />
              ) : (
                allResidents.map((res, index) => {
                  const relColor = getRelationshipColor(res.relationship);
                  return (
                    <React.Fragment key={res.id}>
                      <PremiumPressable
                        style={styles.residentRow}
                        onPress={() => router.push('/family-members')}
                        scaleTo={0.98}
                      >
                        <View style={[styles.avatar, res.isPrimary && styles.avatarPrimary]}>
                          <Text style={[styles.avatarText, res.isPrimary && styles.avatarTextPrimary]}>
                            {getInitials(res.name)}
                          </Text>
                        </View>
                        <View style={styles.residentInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.residentName} numberOfLines={1}>{res.name}</Text>
                            {res.isPrimary && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>You</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.relPill, { backgroundColor: relColor.bg }]}>
                            <Text style={[styles.relPillText, { color: relColor.text }]}>{res.relationship}</Text>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
                      </PremiumPressable>
                      {index < allResidents.length - 1 && <View style={styles.divider} />}
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
              <Feather name="users" size={16} color={theme.colors.primary} />
              <Text style={styles.manageLinkText}>Manage household members</Text>
              <Feather name="arrow-right" size={14} color={theme.colors.primary} />
            </PremiumPressable>
          </View>
        </ScreenEntrance>

        {/* Unit Details */}
        <ScreenEntrance delay={120}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Unit Details</Text>
            <View style={styles.card}>
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
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  content: { paddingTop: 4 },

  /* Hero */
  heroContainer: {
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 28,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 22,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unitNumber: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#FFF',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  unitAddress: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },

  /* Sections */
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sectionCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },

  /* Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  /* Residents */
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPrimary: {
    backgroundColor: theme.colors.primary,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  avatarTextPrimary: {
    color: '#FFFFFF',
  },
  residentInfo: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  residentName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  youBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
  },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 16 },

  /* Manage link */
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
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
    padding: 16,
    gap: 12,
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
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
  skeletonWrap: { padding: 16 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
});
