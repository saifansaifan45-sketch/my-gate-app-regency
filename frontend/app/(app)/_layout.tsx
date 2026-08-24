import { Ionicons } from '@expo/vector-icons';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tabs } from 'expo-router';
import { theme } from '../../src/theme';
import { View, StyleSheet, Animated, Pressable, Platform, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Text';
import { CapabilityInspector } from '../../src/components/debug/CapabilityInspector';
import { WelcomeHomeAnimation } from '../../src/components/welcome-home-animation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../src/api/client';

interface BouncyTabProps {
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused: boolean;
  onPress: () => void;
}

function BouncyTabItem({ activeIcon, inactiveIcon, label, isFocused, onPress }: BouncyTabProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillScale = useRef(new Animated.Value(isFocused ? 1 : 0.7)).current;
  const pillOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.06,
            friction: 9,
            tension: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 10,
            tension: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.spring(pillScale, {
          toValue: 1,
          friction: 9,
          tension: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 10,
          tension: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(pillScale, {
          toValue: 0.7,
          friction: 10,
          tension: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pillOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isFocused, pillOpacity, pillScale, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      friction: 9,
      tension: 240,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.04,
      friction: 9,
      tension: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const activeColor = theme.colors.primary;
  const inactiveColor = '#727B80';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabPill,
          {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          },
        ]}
      />
      <Animated.View style={[styles.tabContent, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons
          name={isFocused ? activeIcon : inactiveIcon}
          size={23}
          color={isFocused ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontFamily: isFocused ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function BouncyCenterButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.95,
        friction: 9,
        tension: 240,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 3,
        duration: 70,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.06,
          friction: 9,
          tension: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 10,
          tension: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  return (
    <View style={styles.centerSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.centerPressable}
      >
        <Animated.View
          style={[
            styles.centerButton,
            {
              transform: [{ scale }, { translateY }],
            },
          ]}
        >
          <View style={styles.centerDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>
      </Pressable>
      <Text style={styles.centerLabel}>Quick</Text>
    </View>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { hasManagerAccess, hasLeadershipAccess, hasResidentAccess, hasOwnerAccess, hasApprovedMembership } = useSession();

  const isLeadershipMode = false; // Leadership always gets full resident access
  const isManagerMode = hasManagerAccess() && !hasResidentAccess() && !hasOwnerAccess();
  const isWorkforceMode = hasApprovedMembership('WORKFORCE') && !hasManagerAccess() && !hasLeadershipAccess() && !hasResidentAccess() && !hasOwnerAccess();
  const { data: workforceData } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => (await api.get('/work/dashboard')).data,
    enabled: isWorkforceMode,
    staleTime: 60_000,
  });
  const isSecurity = workforceData?.personnelProfile?.category?.toUpperCase() === 'SECURITY';

  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(entranceTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 140,
        mass: 0.8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  const currentRoute = state.routes[state.index]?.name;
  
  // Routes where the tab bar should be visible
  const isResidentTab = ['home', 'community', 'services', 'profile'].includes(currentRoute);
  const isManagerTab = ['manager/index', 'manager/tickets/index', 'manager/personnel/index', 'manager/approvals', 'manager/attendance', 'profile'].includes(currentRoute);
  const isLeadershipTab = ['leadership/index', 'leadership/approvals', 'community', 'announcements', 'profile'].includes(currentRoute);
  const isWorkforceTab = ['work/index', 'work/tasks/index', 'work/attendance', 'work/profile'].includes(currentRoute);

  if (isWorkforceMode && !isWorkforceTab) {
    return null;
  }

  if (isLeadershipMode && !isLeadershipTab) {
    return null;
  }

  if (isManagerMode && !isManagerTab) {
    return null;
  }

  if (!isLeadershipMode && !isManagerMode && !isResidentTab) {
    return null;
  }

  const handleTabPress = (name: string) => {
    const routeIndex = state.routes.findIndex((r: any) => r.name === name);
    const isFocused = state.index === routeIndex;

    if (routeIndex !== -1) {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[routeIndex].key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(name);
      }
    }
  };

  const getIsFocused = (name: string) => {
    const routeIndex = state.routes.findIndex((r: any) => r.name === name);
    return state.index === routeIndex;
  };

  return (
    <Animated.View
      style={[
        styles.tabBarWrapper,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          opacity: entranceOpacity,
          transform: [{ translateY: entranceTranslateY }],
        },
      ]}
    >
      <View style={styles.tabBarContainer}>
        {isWorkforceMode ? (
          <>
            <BouncyTabItem
              activeIcon="home"
              inactiveIcon="home-outline"
              label="Dashboard"
              isFocused={getIsFocused('work/index')}
              onPress={() => handleTabPress('work/index')}
            />
            {!isSecurity && <BouncyTabItem
              activeIcon="construct"
              inactiveIcon="construct-outline"
              label="Tasks"
              isFocused={getIsFocused('work/tasks/index')}
              onPress={() => handleTabPress('work/tasks/index')}
            />}
            <BouncyTabItem
              activeIcon="calendar"
              inactiveIcon="calendar-outline"
              label="Attendance"
              isFocused={getIsFocused('work/attendance')}
              onPress={() => handleTabPress('work/attendance')}
            />
            <BouncyTabItem
              activeIcon="person"
              inactiveIcon="person-outline"
              label="Profile"
              isFocused={getIsFocused('work/profile')}
              onPress={() => handleTabPress('work/profile')}
            />
          </>
        ) : isLeadershipMode ? (
          <>
            <BouncyTabItem
              activeIcon="shield"
              inactiveIcon="shield-outline"
              label="Overview"
              isFocused={getIsFocused('leadership/index')}
              onPress={() => handleTabPress('leadership/index')}
            />
            <BouncyTabItem
              activeIcon="checkmark-circle"
              inactiveIcon="checkmark-circle-outline"
              label="Approvals"
              isFocused={getIsFocused('leadership/approvals')}
              onPress={() => handleTabPress('leadership/approvals')}
            />
            <BouncyTabItem
              activeIcon="people"
              inactiveIcon="people-outline"
              label="Community"
              isFocused={getIsFocused('community')}
              onPress={() => handleTabPress('community')}
            />
            <BouncyTabItem
              activeIcon="megaphone"
              inactiveIcon="megaphone-outline"
              label="Notices"
              isFocused={getIsFocused('announcements')}
              onPress={() => handleTabPress('announcements')}
            />
            <BouncyTabItem
              activeIcon="person"
              inactiveIcon="person-outline"
              label="Profile"
              isFocused={getIsFocused('profile')}
              onPress={() => handleTabPress('profile')}
            />
          </>
        ) : isManagerMode ? (
          <>
            <BouncyTabItem
              activeIcon="speedometer"
              inactiveIcon="speedometer-outline"
              label="Dashboard"
              isFocused={getIsFocused('manager/index')}
              onPress={() => handleTabPress('manager/index')}
            />
            <BouncyTabItem
              activeIcon="construct"
              inactiveIcon="construct-outline"
              label="Tickets"
              isFocused={getIsFocused('manager/tickets/index')}
              onPress={() => handleTabPress('manager/tickets/index')}
            />
            <BouncyTabItem
              activeIcon="people"
              inactiveIcon="people-outline"
              label="Personnel"
              isFocused={getIsFocused('manager/personnel/index')}
              onPress={() => handleTabPress('manager/personnel/index')}
            />
            <BouncyTabItem
              activeIcon="checkmark-circle"
              inactiveIcon="checkmark-circle-outline"
              label="Approvals"
              isFocused={getIsFocused('manager/approvals')}
              onPress={() => handleTabPress('manager/approvals')}
            />
            <BouncyTabItem
              activeIcon="calendar"
              inactiveIcon="calendar-outline"
              label="Attendance"
              isFocused={getIsFocused('manager/attendance')}
              onPress={() => handleTabPress('manager/attendance')}
            />
            <BouncyTabItem
              activeIcon="person"
              inactiveIcon="person-outline"
              label="Profile"
              isFocused={getIsFocused('profile')}
              onPress={() => handleTabPress('profile')}
            />
          </>
        ) : (
          <>
            <BouncyTabItem
              activeIcon="home"
              inactiveIcon="home-outline"
              label="Home"
              isFocused={getIsFocused('home')}
              onPress={() => handleTabPress('home')}
            />
            <BouncyTabItem
              activeIcon="people"
              inactiveIcon="people-outline"
              label="Community"
              isFocused={getIsFocused('community')}
              onPress={() => handleTabPress('community')}
            />

            <BouncyCenterButton onPress={() => navigation.navigate('quick-actions')} />

            <BouncyTabItem
              activeIcon="grid"
              inactiveIcon="grid-outline"
              label="Services"
              isFocused={getIsFocused('services')}
              onPress={() => handleTabPress('services')}
            />
            <BouncyTabItem
              activeIcon="person"
              inactiveIcon="person-outline"
              label="Profile"
              isFocused={getIsFocused('profile')}
              onPress={() => handleTabPress('profile')}
            />
          </>
        )}
      </View>
    </Animated.View>
  );
}

import { useSession } from '../../src/store/auth';
import { Redirect } from 'expo-router';
import { useRoleGuard } from '../../src/hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../src/api/notifications';
import { EmergencySOSAlertModal } from '../../src/components/emergency-sos-alert-modal';

export default function AppLayout() {
  useRoleGuard();
  const { user, isLoading, isAuthenticated, hasManagerAccess, hasWorkforceAccess, hasLeadershipAccess } = useSession();
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  const { data: notifData, refetch } = useQuery({
    queryKey: ['notifications', 'sos-polling'],
    queryFn: notificationsApi.getNotifications,
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const unreadSOS = notifData?.notifications?.find((n: any) => !n.readStatus && n.type === 'EMERGENCY_SOS');

  const handleAcknowledgeSOS = async () => {
    if (unreadSOS) {
      await notificationsApi.markRead(unreadSOS.id);
      refetch();
    }
  };

  const userId = user?.id || 'u123';
  const communityId = 'c1';
  const communityName = 'Regency Salma';
  const unitNumber = user?.unitNumber || '9A';
  const firstName = user?.firstName || 'Resident';

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (hasManagerAccess() || hasWorkforceAccess() || hasLeadershipAccess()) {
      setShowWelcome(false);
      return;
    }

    const checkWelcome = async () => {
      try {
        const key = `welcome-home-seen:${userId}:${communityId}:${unitNumber}`;
        const hasSeen = await AsyncStorage.getItem(key);
        if (hasSeen === 'true') {
          setShowWelcome(false);
        } else {
          setShowWelcome(true);
        }
      } catch {
        console.warn('Storage error');
        setShowWelcome(false);
      }
    };
    checkWelcome();
  }, [isAuthenticated, user, userId, communityId, unitNumber, hasManagerAccess, hasWorkforceAccess, hasLeadershipAccess]);

  const handleWelcomeComplete = async () => {
    try {
      const key = `welcome-home-seen:${userId}:${communityId}:${unitNumber}`;
      await AsyncStorage.setItem(key, 'true');
    } catch {
      console.warn('Storage error');
    }
    setShowWelcome(false);
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (showWelcome === null) return null; // wait for check

  return (
    <View style={styles.root}>
      {showWelcome && (
        <WelcomeHomeAnimation
          userId={userId}
          communityId={communityId}
          communityName={communityName}
          unitNumber={unitNumber}
          firstName={firstName}
          onComplete={handleWelcomeComplete}
        />
      )}
      {/* Constrain every tab screen to the same centered 440px column as the
          auth screens so large web viewports never stretch content edge-to-edge. */}
      <View style={styles.appFrame}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            tabBarStyle: { display: showWelcome ? 'none' : 'flex' },
          }}
        >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="community" options={{ title: 'Community' }} />
        <Tabs.Screen name="services" options={{ title: 'Services' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="quick-actions" options={{ href: null }} />
        <Tabs.Screen name="announcements" options={{ href: null }} />
        <Tabs.Screen name="my-home" options={{ href: null }} />
        {/* Calendar disabled until event storage and API support are available. */}
        <Tabs.Screen name="activity-overview" options={{ href: null }} />
        <Tabs.Screen name="activity-log" options={{ href: null }} />
        <Tabs.Screen name="help-desk" options={{ href: null }} />
        <Tabs.Screen name="family-members" options={{ href: null }} />
        <Tabs.Screen name="profile-settings" options={{ href: null }} />
        <Tabs.Screen name="residency-requests" options={{ href: null }} />
        <Tabs.Screen name="visitors/index" options={{ href: null }} />
        <Tabs.Screen name="visitors/[id]" options={{ href: null }} />
        <Tabs.Screen name="services/maintenance" options={{ href: null }} />
        <Tabs.Screen name="services/staff-attendance" options={{ href: null }} />
        <Tabs.Screen name="services/raise-issue" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="manager/index" options={{ href: null }} />
        <Tabs.Screen name="manager/tickets/index" options={{ href: null }} />
        <Tabs.Screen name="manager/tickets/[id]" options={{ href: null }} />
        <Tabs.Screen name="manager/tickets/assign" options={{ href: null }} />
        <Tabs.Screen name="manager/personnel/index" options={{ href: null }} />
        <Tabs.Screen name="manager/personnel/[id]" options={{ href: null }} />
        <Tabs.Screen name="manager/approvals" options={{ href: null }} />
        <Tabs.Screen name="manager/attendance" options={{ href: null }} />
        <Tabs.Screen name="manager/visitors" options={{ href: null }} />
        <Tabs.Screen name="manager/visitors/audit/[id]" options={{ href: null }} />
        <Tabs.Screen name="manager/tasks" options={{ href: null }} />
        <Tabs.Screen name="leadership/index" options={{ href: null }} />
        <Tabs.Screen name="leadership/approvals" options={{ href: null }} />
        <Tabs.Screen name="leadership/create-announcement" options={{ href: null }} />
        <Tabs.Screen name="work/index" options={{ href: null }} />
        <Tabs.Screen name="work/tasks/index" options={{ href: null }} />
        <Tabs.Screen name="work/tasks/history" options={{ href: null }} />
        <Tabs.Screen name="work/tasks/[id]" options={{ href: null }} />
        <Tabs.Screen name="work/attendance" options={{ href: null }} />
        <Tabs.Screen name="work/profile" options={{ href: null }} />
        <Tabs.Screen name="work/visitors" options={{ href: null }} />
        </Tabs>
      </View>
      <EmergencySOSAlertModal
        visible={!!unreadSOS}
        title={unreadSOS?.title || 'Emergency SOS'}
        message={unreadSOS?.message || 'An emergency SOS was triggered.'}
        onAcknowledge={handleAcknowledgeSOS}
      />
      <CapabilityInspector />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
  },
  tabBarWrapper: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: -7 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  tabBarContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    height: 62,
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabPill: {
    position: 'absolute',
    width: 50,
    height: 34,
    borderRadius: 15,
    top: 4,
    backgroundColor: '#E7F1E9',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.05,
  },
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
  centerDots: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
});
