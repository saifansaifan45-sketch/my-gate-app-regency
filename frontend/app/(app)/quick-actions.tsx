import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Feather } from '@expo/vector-icons';
import { EmergencySOSModal } from '../../src/components/emergency-sos-modal';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useSession } from '../../src/store/auth';
import { SERVICE_CATALOG } from '../../src/registry/services';
import { theme } from '../../src/theme';

export default function QuickActionsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(true);
  const { user } = useSession();
  const [isEmergencySOSVisible, setIsEmergencySOSVisible] = useState(false);

  const availableServices = SERVICE_CATALOG.filter(s => s.availableRoles.includes((user?.role as any) || ''));

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="All Quick Actions" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {availableServices.map(service => (
            <Pressable
              key={service.id}
              style={[styles.card, service.isEmergency && styles.cardEmergency]}
              onPress={() => {
                if (service.isEmergency) setIsEmergencySOSVisible(true);
                else router.push(service.route);
              }}
            >
              <View style={[styles.iconWrap, service.isEmergency && styles.iconWrapEmergency]}>
                <Feather name={service.icon as any} size={24} color={service.isEmergency ? theme.colors.error : theme.colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{service.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <EmergencySOSModal visible={isEmergencySOSVisible} onClose={() => setIsEmergencySOSVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', gap: 12 },
  cardEmergency: { borderColor: '#FFCDD2', backgroundColor: '#FFF7F7' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  iconWrapEmergency: { backgroundColor: '#FFEBEE' },
  cardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#374151', textAlign: 'center' }
});
