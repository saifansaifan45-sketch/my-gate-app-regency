import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Feather } from '@expo/vector-icons';
import { EmergencySOSModal } from '../../src/components/emergency-sos-modal';
import { AddVisitorModal } from '../../src/components/add-visitor-modal';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useSession } from '../../src/store/auth';
import { QUICK_ACTION_VISUALS, SERVICE_CATALOG, ServiceEntry } from '../../src/registry/services';
import { theme } from '../../src/theme';
import { smartBack } from '../../src/navigation/history';

const DEFAULT_VISIBLE_QUICK_ACTIONS = ['add-visitor', 'help-desk', 'announcements', 'maintenance'];

type QuickActionPreference = {
  id: string;
  visible: boolean;
};

type VisitorPassConfig = {
  visitorType: 'GUEST' | 'CAB' | 'DELIVERY';
  title: string;
};

const createDefaultPreferences = (role?: string): QuickActionPreference[] =>
  SERVICE_CATALOG
    .filter((service) => service.availableRoles.includes(role || ''))
    .map((service) => ({
      id: service.id,
      visible: DEFAULT_VISIBLE_QUICK_ACTIONS.includes(service.id),
    }));

export default function QuickActionsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(true);
  const { user } = useSession();
  const [preferences, setPreferences] = useState<QuickActionPreference[]>([]);
  const [isEmergencySOSVisible, setIsEmergencySOSVisible] = useState(false);
  const [visitorPassConfig, setVisitorPassConfig] = useState<VisitorPassConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const defaults = createDefaultPreferences(user?.role);
    const storageKey = user?.id ? `quick-actions:${user.id}` : null;

    setPreferences(defaults);
    if (!storageKey) return () => { cancelled = true; };

    AsyncStorage.getItem(storageKey).then((stored) => {
      if (cancelled || !stored) return;

      try {
        const saved = JSON.parse(stored) as QuickActionPreference[];
        const defaultIds = new Set(defaults.map((action) => action.id));
        const restored = saved
          .filter((action) => defaultIds.has(action.id))
          .map((action) => ({ id: action.id, visible: Boolean(action.visible) }));
        const restoredIds = new Set(restored.map((action) => action.id));

        if (!cancelled) {
          setPreferences([...restored, ...defaults.filter((action) => !restoredIds.has(action.id))]);
        }
      } catch {
        // Keep the same defaults as Home if a stale preference cannot be read.
      }
    });

    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  const quickActions = useMemo(() => preferences
    .filter((action) => action.visible)
    .slice(0, 5)
    .map((action) => SERVICE_CATALOG.find((service) => service.id === action.id))
    .filter((service): service is ServiceEntry => Boolean(service)), [preferences]);

  const openAction = (service: ServiceEntry) => {
    if (service.id === 'sos') {
      setIsEmergencySOSVisible(true);
    } else if (service.id === 'add-visitor') {
      setVisitorPassConfig({ visitorType: 'GUEST', title: 'Approve Entries' });
    } else if (service.id === 'cab-alert') {
      setVisitorPassConfig({ visitorType: 'CAB', title: 'Approve Entries' });
    } else if (service.id === 'delivery') {
      setVisitorPassConfig({ visitorType: 'DELIVERY', title: 'Approve Entries' });
    } else if (service.id === 'house-help') {
      router.push({ pathname: '/services/raise-issue', params: { category: 'Custom', description: 'I need house help' } });
    } else {
      router.push(service.route);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Quick actions" onBackPress={() => smartBack(router, '/home')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {quickActions.map((service) => (
            <Pressable
              key={service.id}
              style={[styles.card, service.isEmergency && styles.cardEmergency]}
              onPress={() => openAction(service)}
            >
              <View style={[styles.iconWrap, { backgroundColor: service.isEmergency ? QUICK_ACTION_VISUALS.emergency.background : QUICK_ACTION_VISUALS.standard.background }]}>
                <Feather name={service.icon as any} size={24} color={service.isEmergency ? QUICK_ACTION_VISUALS.emergency.icon : QUICK_ACTION_VISUALS.standard.icon} />
              </View>
              <Text style={styles.cardTitle}>{service.label}</Text>
            </Pressable>
          ))}
        </View>
        {quickActions.length === 0 && <Text style={styles.emptyText}>Choose quick actions from Home to see them here.</Text>}
      </ScrollView>
      <AddVisitorModal
        visible={Boolean(visitorPassConfig)}
        onClose={() => setVisitorPassConfig(null)}
        initialVisitorType={visitorPassConfig?.visitorType}
        title={visitorPassConfig?.title}
        onSuccess={() => setVisitorPassConfig(null)}
      />
      <EmergencySOSModal visible={isEmergencySOSVisible} onClose={() => setIsEmergencySOSVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: theme.colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 12 },
  cardEmergency: { borderColor: theme.status.danger.border, backgroundColor: theme.status.danger.background },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', color: theme.colors.textSecondary, textAlign: 'center', marginTop: 28 },
});
