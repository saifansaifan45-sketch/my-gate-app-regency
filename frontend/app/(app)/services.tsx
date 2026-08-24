import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { ActionCard } from '../../src/components/ui/ActionCard';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { EmergencySOSModal } from '../../src/components/emergency-sos-modal';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useSession } from '../../src/store/auth';
import { SERVICE_CATALOG } from '../../src/registry/services';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

export default function ServicesScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(true);
  const { user, hasRole } = useSession();
  const [isEmergencySOSVisible, setIsEmergencySOSVisible] = useState(false);

  // Group services by category
  const categories: Record<string, typeof SERVICE_CATALOG> = {};
  
  SERVICE_CATALOG.forEach(service => {
    // Check if role has access
    if (service.availableRoles.includes((user?.role as any) || '')) {
      if (!categories[service.category]) categories[service.category] = [];
      categories[service.category].push(service);
    }
  });

  return (
    <View style={styles.container}>
      <AppHeader variant="tabroot" title="Services" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
        
        {hasRole('MANAGER') && (
          <View style={styles.categoryBlock}>
             <Text style={styles.categoryTitle}>Manager Operations</Text>
             <ActionCard
                style={{ backgroundColor: theme.colors.surfaceGreen, borderColor: theme.status.success.border, marginBottom: 12 }}
                onPress={() => router.push('/manager')}
                icon={<MaterialCommunityIcons name="shield-account" size={24} color={theme.colors.onPrimary} />}
                iconBackground={theme.colors.primary}
                title="Manager Dashboard"
                description="Tickets, personnel assignments & staff attendance"
                supportingLabel="Manage community"
                accentColor={theme.colors.primary}
/>
          </View>
        )}

        {Object.keys(categories).map(cat => (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{cat}</Text>
            {categories[cat].map(service => (
              <ActionCard
                key={service.id}
                style={service.isEmergency ? { backgroundColor: theme.status.danger.background, borderColor: theme.status.danger.border, marginBottom: 12 } : { marginBottom: 12 }}
                onPress={() => {
                  if (service.isEmergency) setIsEmergencySOSVisible(true);
                  else router.push(service.route);
                }}
                icon={<Feather name={service.icon as any} size={22} color={service.isEmergency ? theme.colors.error : theme.colors.primary} />}
                iconBackground={service.isEmergency ? theme.status.danger.background : theme.colors.surfaceGreen}
                title={service.label}
                description={service.description}
                supportingLabel={service.category}
                accentColor={service.isEmergency ? theme.status.danger.foreground : theme.colors.primary}
/>
            ))}
          </View>
        ))}
        
      </ScrollView>
      <EmergencySOSModal visible={isEmergencySOSVisible} onClose={() => setIsEmergencySOSVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 16 },
  categoryBlock: { marginBottom: 20 },
  categoryTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginBottom: 12, marginLeft: 4 }
});
