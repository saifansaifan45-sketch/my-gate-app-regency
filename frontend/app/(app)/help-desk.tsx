import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { householdApi } from '../../src/api/household';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Text } from '../../src/components/ui/Text';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { smartBack } from '../../src/navigation/history';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

export default function HelpDeskScreen() {
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);
  const { data, isLoading } = useQuery({ queryKey: ['help-desk-contact'], queryFn: householdApi.getHelpDeskContact });
  const manager = data?.manager;
  const callManager = () => {
    if (manager?.phoneNumber) Linking.openURL(`tel:${manager.phoneNumber}`);
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader variant="subscreen" title="Help Desk" onBackPress={() => smartBack(router, '/home')} />
      <View style={[styles.content, { paddingBottom: bottomClearance + 24 }]}>
        <View style={styles.heroIcon}><Feather name="headphones" size={28} color="#FFFFFF" /></View>
        <Text style={styles.title}>We’re here to help</Text>
        <Text style={styles.subtitle}>Call your community manager for urgent help, or raise a ticket and follow its progress in the app.</Text>
        <View style={styles.contactCard}>
          {isLoading ? <ActivityIndicator color={theme.colors.primary} /> : manager ? <>
            <View style={styles.contactIcon}><Feather name="phone-call" size={19} color={theme.colors.primary} /></View>
            <View style={styles.contactCopy}><Text style={styles.contactLabel}>Community manager</Text><Text style={styles.contactName}>{manager.name}</Text><Text style={styles.contactNumber}>{manager.phoneNumber || 'Direct number unavailable'}</Text></View>
            {manager.phoneNumber ? <PremiumPressable style={styles.callButton} onPress={callManager} accessibilityRole="button" accessibilityLabel={`Call ${manager.name}`}><Feather name="phone" size={18} color="#FFFFFF" /></PremiumPressable> : null}
          </> : <><View style={styles.contactIcon}><Feather name="message-circle" size={19} color={theme.colors.primary} /></View><View style={styles.contactCopy}><Text style={styles.contactLabel}>Community help desk</Text><Text style={styles.contactName}>Raise a ticket anytime</Text><Text style={styles.contactNumber}>A manager will receive and respond to it.</Text></View></>}
        </View>
        <View style={styles.note}><Feather name="clock" size={16} color="#A16207" /><Text style={styles.noteText}>For an immediate safety concern, use Emergency SOS.</Text></View>
        <Button label="Raise a ticket" icon="tool" onPress={() => router.push('/services/raise-issue')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background }, content: { flex: 1, paddingHorizontal: cardSystem.pagePadding, paddingTop: 34 }, heroIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 24, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...theme.shadows.floating }, title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 25, letterSpacing: -0.5, textAlign: 'center', color: theme.colors.textPrimary, marginBottom: 8 }, subtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', color: theme.colors.textSecondary, marginHorizontal: 14, marginBottom: 28 }, contactCard: { minHeight: 104, backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, ...theme.shadows.card }, contactIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, contactCopy: { flex: 1 }, contactLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }, contactName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 }, contactNumber: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: theme.colors.textSecondary }, callButton: { width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, marginLeft: 8 }, note: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF8E8', borderRadius: 13, marginBottom: 24 }, noteText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, lineHeight: 18, color: '#775B20' },
});
