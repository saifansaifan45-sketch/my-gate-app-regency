/* eslint-disable @typescript-eslint/no-require-imports */
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useSession } from '../../src/store/auth';
import { theme } from '../../src/theme';

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

  const residents = [
    {
      id: user?.id || 'primary',
      name: displayName,
      rel: `${relationshipLabel} (${primaryResidency?.status || 'Active'})`,
    },
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title={`Residence ${unitNumber}`}
        rightAction={
          <PremiumPressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => router.push('/profile-settings')}
            style={styles.headerIconBtn}
          >
            <Feather name="settings" size={20} color={theme.colors.textPrimary} />
          </PremiumPressable>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}>
        <View style={styles.heroContainer}>
          <Image 
            source={require('../../assets/hero-image.png')} 
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.unitNumber}>{unitNumber}</Text>
            <Text style={styles.homeName}>My Home</Text>
            <Text style={styles.unitAddress}>Regency Salma Township</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered Residents</Text>
          <View style={styles.card}>
            {residents.map((res, index) => (
              <React.Fragment key={res.id}>
                <PremiumPressable style={styles.row} onPress={() => router.push('/family-members')}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{res.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{res.name}</Text>
                    <Text style={styles.rowSubtitle}>{res.rel}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </PremiumPressable>
                {index < residents.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unit Details</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Apartment / Unit</Text>
              <Text style={styles.infoValue}>{unitNumber}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Township</Text>
              <Text style={styles.infoValue}>Regency Salma</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <Text style={[styles.infoValue, { color: '#047857' }]}>Active Resident</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  content: { padding: 20 },
  heroContainer: {
    height: 180,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 20,
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: { zIndex: 1 },
  unitNumber: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#FFF',
    letterSpacing: -0.5,
  },
  homeName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  unitAddress: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    marginLeft: 4,
  },
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  rowInfo: { flex: 1 },
  rowTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
});
