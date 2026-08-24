import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVICE_CATALOG, QUICK_ACTION_VISUALS, ServiceEntry } from '../../registry/services';
import { useSession } from '../../store/auth';
import { theme } from '../../theme';
import { AddVisitorModal } from '../add-visitor-modal';
import { EmergencySOSModal } from '../emergency-sos-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_SIZE = 56;
const ACTION_RADIUS = ACTION_SIZE / 2;
const ORBIT_RADIUS = 100;
const CENTER_BUTTON_SIZE = 56;

const DEFAULT_VISIBLE = ['add-visitor', 'help-desk', 'announcements', 'maintenance'];

interface RadialAction {
  service: ServiceEntry;
  angle: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
}

export function QuickActionsRadial() {
  const router = useRouter();
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [actions, setActions] = useState<ServiceEntry[]>([]);
  const [radialActions, setRadialActions] = useState<RadialAction[]>([]);
  const [visitorPassConfig, setVisitorPassConfig] = useState<{ visitorType: 'GUEST' | 'CAB' | 'DELIVERY'; title: string } | null>(null);
  const [isSOSVisible, setIsSOSVisible] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(1)).current;
  const centerRotation = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const menuVisible = useRef(false);

  // Load quick action preferences
  useEffect(() => {
    let cancelled = false;
    const defaults = SERVICE_CATALOG.filter((s) =>
      s.availableRoles.includes(user?.role || '')
    ).map((s) => ({ id: s.id, visible: DEFAULT_VISIBLE.includes(s.id) }));

    const storageKey = user?.id ? `quick-actions:${user.id}` : null;
    if (!storageKey) {
      const visible = defaults.filter((d) => d.visible).slice(0, 5);
      const services = visible.map((v) => SERVICE_CATALOG.find((s) => s.id === v.id)!).filter(Boolean);
      if (!cancelled) setActions(services);
      return () => { cancelled = true; };
    }

    AsyncStorage.getItem(storageKey).then((stored) => {
      if (cancelled || !stored) return;
      try {
        const saved = JSON.parse(stored) as { id: string; visible: boolean }[];
        const defaultIds = new Set(defaults.map((d) => d.id));
        const restored = saved
          .filter((a) => defaultIds.has(a.id))
          .map((a) => ({ id: a.id, visible: Boolean(a.visible) }));
        const visible = restored.filter((a) => a.visible).slice(0, 5);
        const services = visible.map((v) => SERVICE_CATALOG.find((s) => s.id === v.id)!).filter(Boolean);
        if (!cancelled && services.length > 0) setActions(services);
      } catch { /* keep defaults */ }
    });

    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  // Create radial action items when actions change
  useEffect(() => {
    if (actions.length === 0) return;
    const count = actions.length;
    const startAngle = -Math.PI / 2 - (Math.PI * 0.6);
    const endAngle = -Math.PI / 2 + (Math.PI * 0.6);
    const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

    const items: RadialAction[] = actions.map((service, i) => ({
      service,
      angle: count === 1 ? -Math.PI / 2 : startAngle + angleStep * i,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }));
    setRadialActions(items);
  }, [actions]);

  const openMenu = useCallback(() => {
    if (menuVisible.current) return;
    menuVisible.current = true;
    setIsOpen(true);

    // Reset all items
    radialActions.forEach((a) => {
      a.x.setValue(0);
      a.y.setValue(0);
      a.scale.setValue(0);
      a.opacity.setValue(0);
    });

    // Phase 1: Backdrop fades in, ring pulses out, center rotates
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.sequence([
        Animated.spring(ringScale, {
          toValue: 1.3,
          friction: 6,
          tension: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ringScale, {
          toValue: 1,
          friction: 8,
          tension: 120,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.timing(ringOpacity, {
        toValue: 0.15,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(centerRotation, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(centerScale, {
        toValue: 0.85,
        friction: 6,
        tension: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Phase 2: Items spring outward with stagger
    radialActions.forEach((action, index) => {
      const targetX = Math.cos(action.angle) * ORBIT_RADIUS;
      const targetY = Math.sin(action.angle) * ORBIT_RADIUS;

      Animated.parallel([
        Animated.sequence([
          Animated.delay(60 + index * 55),
          Animated.spring(action.x, {
            toValue: targetX,
            friction: 7,
            tension: 90,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(60 + index * 55),
          Animated.spring(action.y, {
            toValue: targetY,
            friction: 7,
            tension: 90,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(80 + index * 55),
          Animated.spring(action.scale, {
            toValue: 1,
            friction: 5,
            tension: 120,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(80 + index * 55),
          Animated.timing(action.opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start();
    });
  }, [radialActions, backdropOpacity, ringScale, ringOpacity, centerRotation, centerScale]);

  const closeMenu = useCallback((onComplete?: () => void) => {
    if (!menuVisible.current) return;

    // Collapse items inward with reverse stagger
    radialActions.forEach((action, index) => {
      const delay = (radialActions.length - 1 - index) * 40;
      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(action.x, {
            toValue: 0,
            friction: 8,
            tension: 160,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(action.y, {
            toValue: 0,
            friction: 8,
            tension: 160,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(action.scale, {
            toValue: 0,
            friction: 8,
            tension: 160,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(action.opacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start();
    });

    // Collapse center, fade backdrop
    Animated.parallel([
      Animated.spring(centerScale, {
        toValue: 1,
        friction: 8,
        tension: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(centerRotation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(ringScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      menuVisible.current = false;
      setIsOpen(false);
      onComplete?.();
    });
  }, [radialActions, centerScale, centerRotation, ringOpacity, ringScale, backdropOpacity]);

  const handleActionPress = useCallback((service: ServiceEntry) => {
    // Animate the pressed item
    const action = radialActions.find((a) => a.service.id === service.id);
    if (action) {
      Animated.sequence([
        Animated.spring(action.scale, {
          toValue: 1.3,
          friction: 5,
          tension: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(action.scale, {
          toValue: 0,
          friction: 8,
          tension: 160,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }

    closeMenu(() => {
      // Execute action after menu closes
      if (service.id === 'sos') {
        setIsSOSVisible(true);
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
    });
  }, [radialActions, closeMenu, router]);

  const toggleMenu = useCallback(() => {
    if (menuVisible.current) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [openMenu, closeMenu]);

  const interpolateRotation = centerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      <View style={styles.centerSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick actions"
          onPress={toggleMenu}
          style={styles.centerPressable}
        >
          <Animated.View
            style={[
              styles.centerButton,
              {
                transform: [
                  { scale: centerScale },
                  { rotate: interpolateRotation },
                ],
              },
            ]}
          >
            <Feather name="plus" size={24} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
        <Text style={styles.centerLabel}>Quick</Text>
      </View>

      <Modal visible={isOpen} transparent statusBarTranslucent onRequestClose={() => closeMenu()}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />

          {/* Radial menu container - positioned above the tab bar */}
          <View style={styles.radialContainer}>
            {/* Expanding ring */}
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />

            {/* Action items */}
            {radialActions.map((action) => {
              const isEmergency = action.service.isEmergency;
              const visuals = isEmergency ? QUICK_ACTION_VISUALS.emergency : QUICK_ACTION_VISUALS.standard;

              return (
                <Animated.View
                  key={action.service.id}
                  style={[
                    styles.actionItem,
                    {
                      opacity: action.opacity,
                      transform: [
                        { translateX: action.x },
                        { translateY: action.y },
                        { scale: action.scale },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.actionButton,
                      { backgroundColor: visuals.background },
                    ]}
                    onPress={() => handleActionPress(action.service)}
                    onPressIn={() => {
                      Animated.spring(action.scale, {
                        toValue: 0.88,
                        friction: 6,
                        tension: 200,
                        useNativeDriver: Platform.OS !== 'web',
                      }).start();
                    }}
                    onPressOut={() => {
                      if (menuVisible.current) {
                        Animated.spring(action.scale, {
                          toValue: 1,
                          friction: 6,
                          tension: 200,
                          useNativeDriver: Platform.OS !== 'web',
                        }).start();
                      }
                    }}
                  >
                    <Feather
                      name={action.service.icon as any}
                      size={22}
                      color={visuals.icon}
                    />
                  </Pressable>
                  <Text style={styles.actionLabel}>{action.service.label}</Text>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </Modal>

      <AddVisitorModal
        visible={Boolean(visitorPassConfig)}
        onClose={() => setVisitorPassConfig(null)}
        initialVisitorType={visitorPassConfig?.visitorType}
        title={visitorPassConfig?.title}
        onSuccess={() => setVisitorPassConfig(null)}
      />
      <EmergencySOSModal visible={isSOSVisible} onClose={() => setIsSOSVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  centerSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: 2,
    position: 'relative',
  },
  centerPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -22,
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  centerLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: -0.05,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  radialContainer: {
    position: 'absolute',
    bottom: 80,
    left: SCREEN_WIDTH / 2 - ORBIT_RADIUS - ACTION_SIZE,
    width: (ORBIT_RADIUS + ACTION_SIZE) * 2,
    height: (ORBIT_RADIUS + ACTION_SIZE) * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ORBIT_RADIUS * 2 + ACTION_SIZE,
    height: ORBIT_RADIUS * 2 + ACTION_SIZE,
    borderRadius: (ORBIT_RADIUS * 2 + ACTION_SIZE) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  actionItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: ACTION_SIZE + 30,
  },
  actionButton: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  actionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
