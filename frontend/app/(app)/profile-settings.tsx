import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../src/navigation/history';
import { Text } from '../../src/components/ui/Text';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);

  const renderSection = (title: string, items: { label: string, icon: any, onClick?: () => void, rightElement?: React.ReactNode }[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, index) => (
          <PremiumPressable 
            key={index} 
            style={[styles.row, index === items.length - 1 && styles.noBorder]}
            onPress={item.onClick}
            disabled={!item.onClick && !item.rightElement}
          >
            <View style={styles.rowLeft}>
              <Feather name={item.icon} size={18} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={styles.rowLabel}>{item.label}</Text>
            </View>
            {item.rightElement ? item.rightElement : <Feather name="chevron-right" size={18} color="rgba(0,0,0,0.2)" />}
          </PremiumPressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader
        variant="subscreen"
        title="Settings"
        onBackPress={() => smartBack(router, '/profile')}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}>
        <ScreenEntrance delay={100}>
          {renderSection('Account', [
            { label: 'Change password', icon: 'lock', onClick: () => router.push('/change-password') },
          ])}
        </ScreenEntrance>

        <ScreenEntrance delay={200}>
          {renderSection('Community and home', [
            { label: 'Community Hub', icon: 'map-pin', onClick: () => router.push('/community-hub') },
            { label: 'My home', icon: 'home', onClick: () => router.push('/my-home') },
          ])}
        </ScreenEntrance>

        <ScreenEntrance delay={300}>
          {renderSection('Family members', [
            { label: 'Manage family members', icon: 'users', onClick: () => router.push('/family-members') },
          ])}
        </ScreenEntrance>

        {/* Calendar disabled until event storage and API support are available. */}
      </ScrollView>
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
    paddingTop: 12,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.primary,
  }
});
