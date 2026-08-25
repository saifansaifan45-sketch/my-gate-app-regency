import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { smartBack } from '../../src/navigation/history';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';

export default function CommunityHubScreen() {
  const router = useRouter();
  const { top } = useScreenInsets(false);

  const { data: hubData, isLoading: hubLoading } = useQuery({
    queryKey: ['communityHub'],
    queryFn: async () => {
      const res = await api.get('/community/hub');
      return res.data;
    }
  });

  const isLoading = hubLoading;
  
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <AppHeader variant="subscreen" title="Community Hub" onBackPress={() => smartBack(router, '/profile-settings')} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!hubData?.community) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <AppHeader variant="subscreen" title="Community Hub" onBackPress={() => smartBack(router, '/profile-settings')} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Feather name="alert-circle" size={40} color={theme.colors.textSecondary} style={{ marginBottom: 12 }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: theme.colors.textPrimary, textAlign: 'center' }}>No Community Access</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }}>You do not have an active membership in any community.</Text>
        </View>
      </View>
    );
  }

  const { community, role, leadership } = hubData;

  const renderSection = (title: string, items: { label: string, icon: any, onClick?: () => void }[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, index) => (
          <PremiumPressable 
            key={index} 
            style={[styles.row, index === items.length - 1 && styles.noBorder]}
            onPress={item.onClick}
            disabled={!item.onClick}
          >
            <View style={styles.rowLeft}>
              <Feather name={item.icon} size={18} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={styles.rowLabel}>{item.label}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(0,0,0,0.2)" />
          </PremiumPressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader variant="subscreen" title="Community Hub" onBackPress={() => smartBack(router, '/profile-settings')} />
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Feather name="map" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{community.name}</Text>
          <Text style={styles.heroAddress}>{community.address || 'Address not provided'}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Role: {role}</Text>
          </View>
        </View>

        {renderSection('Updates & Connections', [
          { label: 'Announcements & Polls', icon: 'radio', onClick: () => router.push('/community') },
          { label: 'Community Spaces', icon: 'message-circle', onClick: () => router.push('/community') }
        ])}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leadership Contacts</Text>
          <View style={styles.card}>
            {leadership?.length > 0 ? leadership.map((leader: any, index: number) => (
              <View key={leader.id} style={[styles.row, index === leadership.length - 1 && styles.noBorder, { paddingVertical: 14 }]}>
                <View style={styles.rowLeft}>
                  <View style={styles.avatarPill}><Text style={styles.avatarPillText}>{leader.name?.charAt(0) || 'L'}</Text></View>
                  <View>
                    <Text style={styles.rowLabel}>{leader.name || 'Anonymous'}</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary }}>Leadership</Text>
                  </View>
                </View>
              </View>
            )) : (
              <View style={[styles.row, styles.noBorder]}>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary }}>No leadership contacts available.</Text>
              </View>
            )}
          </View>
        </View>

        {renderSection('Support', [
          { label: 'Help Desk / Tickets', icon: 'life-buoy', onClick: () => router.push('/help-desk') },
          // Disabled: Lost & Found has no backend route or persistence yet.
        ])}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingBottom: 100, paddingTop: 16, gap: 24 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EAF6EE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  heroAddress: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  rolePill: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 98 },
  rolePillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textPrimary },
  section: { gap: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  noBorder: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textPrimary },
  avatarPill: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3D6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarPillText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#A46100' }
});
