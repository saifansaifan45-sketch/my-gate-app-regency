import { Feather } from '@expo/vector-icons';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tabs } from 'expo-router';
import { theme } from '../../src/theme';
import { View, StyleSheet, Animated, Pressable, Platform, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Text';
import { WelcomeHomeAnimation } from '../../src/components/welcome-home-animation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../src/api/client';
import { QuickActionsRadial } from '../../src/components/ui/QuickActionsRadial';

interface BouncyTabProps {
  activeIcon: keyof typeof Feather.glyphMap;
  inactiveIcon: keyof typeof Feather.glyphMap;
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
        <Feather
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

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { hasManagerAccess, hasLeadershipAccess, hasResidentAccess, hasOwnerAccess, hasApprovedMembership } = useSession();

  const currentRoute = state.routes[state.index]?.name as string | undefined;
  const isOnLeadershipRoute =
    (currentRoute?.startsWith('leadership/') ?? false) ||
    currentRoute === 'announcements';
  const isOnManagerRoute = currentRoute?.startsWith('manager/') ?? false;
  const isLeadershipMember = hasApprovedMembership('LEADERSHIP');
  const isManagerMember = hasManagerAccess();

  // Hybrid accounts keep the resident bar on resident screens, but must get
  // their operations bar as soon as they enter a management section.
  const isLeadershipMode = isLeadershipMember && (isOnLeadershipRoute || (!hasResidentAccess() && !hasOwnerAccess()));
  const isManagerMode = !isLeadershipMode && isManagerMember && (isOnManagerRoute || (!hasResidentAccess() && !hasOwnerAccess()));
  const isWorkforceMode = hasApprovedMembership('WORKFORCE') && !hasManagerAccess() && !hasLeadershipAccess() && !hasResidentAccess() && !hasOwnerAccess();
  const { data: workforceData } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => (await api.get('/work/dashboard')).data,
    enabled: isWorkforceMode,
    staleTime: 60_000,
  });
  const isSecurity = workforceData?.personnelProfile?.category?.toUpperCase() === 'SECURITY';

  // React Native Web marks an opacity-0 navigation subtree as aria-hidden. If
  // a tab button still owns focus during that frame, Chrome reports a blocked
  // aria-hidden warning. Keep the tab bar immediately available on web while
  // preserving the entrance motion on native platforms.
  const entranceOpacity = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  const entranceTranslateY = useRef(new Animated.Value(Platform.OS === 'web' ? 0 : 18)).current;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(entranceTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 140,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Routes where the tab bar should be visible
  const visibleRoute = currentRoute ?? '';
  const isResidentTab = ['home', 'community', 'services', 'profile'].includes(visibleRoute);
  const isManagerTab = ['manager/index', 'manager/tickets/index', 'manager/personnel/index', 'manager/visitors', 'profile'].includes(visibleRoute);
  const isLeadershipTab = ['leadership/index', 'leadership/approvals', 'leadership/tickets', 'announcements'].includes(visibleRoute);
  const isWorkforceTab = ['work/index', 'work/tasks/index', 'work/attendance', 'work/profile'].includes(visibleRoute);

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
              inactiveIcon="home"
              label="Dashboard"
              isFocused={getIsFocused('work/index')}
              onPress={() => handleTabPress('work/index')}
            />
            {!isSecurity && <BouncyTabItem
              activeIcon="tool"
              inactiveIcon="tool"
              label="Tasks"
              isFocused={getIsFocused('work/tasks/index')}
              onPress={() => handleTabPress('work/tasks/index')}
            />}
            <BouncyTabItem
              activeIcon="calendar"
              inactiveIcon="calendar"
              label="Attendance"
              isFocused={getIsFocused('work/attendance')}
              onPress={() => handleTabPress('work/attendance')}
            />
            <BouncyTabItem
              activeIcon="user"
              inactiveIcon="user"
              label="Profile"
              isFocused={getIsFocused('work/profile')}
              onPress={() => handleTabPress('work/profile')}
            />
          </>
        ) : isLeadershipMode ? (
          <>
            <BouncyTabItem
              activeIcon="shield"
              inactiveIcon="shield"
              label="Overview"
              isFocused={getIsFocused('leadership/index')}
              onPress={() => handleTabPress('leadership/index')}
            />
            <BouncyTabItem
              activeIcon="check-circle"
              inactiveIcon="check-circle"
              label="Approvals"
              isFocused={getIsFocused('leadership/approvals')}
              onPress={() => handleTabPress('leadership/approvals')}
            />
            <BouncyTabItem
              activeIcon="file-text"
              inactiveIcon="file-text"
              label="Tickets"
              isFocused={getIsFocused('leadership/tickets')}
              onPress={() => handleTabPress('leadership/tickets')}
            />
            <BouncyTabItem
              activeIcon="volume-2"
              inactiveIcon="volume-2"
              label="Notices"
              isFocused={getIsFocused('announcements')}
              onPress={() => handleTabPress('announcements')}
            />
          </>
        ) : isManagerMode ? (
          <>
            <BouncyTabItem
              activeIcon="activity"
              inactiveIcon="activity"
              label="Overview"
              isFocused={getIsFocused('manager/index')}
              onPress={() => handleTabPress('manager/index')}
            />
            <BouncyTabItem
              activeIcon="file-text"
              inactiveIcon="file-text"
              label="Requests"
              isFocused={getIsFocused('manager/tickets/index')}
              onPress={() => handleTabPress('manager/tickets/index')}
            />
            <BouncyTabItem
              activeIcon="users"
              inactiveIcon="users"
              label="Staff"
              isFocused={getIsFocused('manager/personnel/index')}
              onPress={() => handleTabPress('manager/personnel/index')}
            />
            <BouncyTabItem
              activeIcon="shield"
              inactiveIcon="shield"
              label="Gate"
              isFocused={getIsFocused('manager/visitors')}
              onPress={() => handleTabPress('manager/visitors')}
            />
            <BouncyTabItem
              activeIcon="user"
              inactiveIcon="user"
              label="Profile"
              isFocused={getIsFocused('profile')}
              onPress={() => handleTabPress('profile')}
            />
          </>
        ) : (
          <>
            <BouncyTabItem
              activeIcon="home"
              inactiveIcon="home"
              label="Home"
              isFocused={getIsFocused('home')}
              onPress={() => handleTabPress('home')}
            />
            <BouncyTabItem
              activeIcon="users"
              inactiveIcon="users"
              label="Community"
              isFocused={getIsFocused('community')}
              onPress={() => handleTabPress('community')}
            />

            <QuickActionsRadial />

            <BouncyTabItem
              activeIcon="grid"
              inactiveIcon="grid"
              label="Services"
              isFocused={getIsFocused('services')}
              onPress={() => handleTabPress('services')}
            />
            <BouncyTabItem
              activeIcon="user"
              inactiveIcon="user"
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

import { useResponsive } from '../../src/hooks/useResponsive';

export default function AppLayout() {
  useRoleGuard();
  const { user, isLoading, isAuthenticated, hasManagerAccess, hasWorkforceAccess, hasLeadershipAccess } = useSession();
  const { maxAppWidth } = useResponsive();
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  const { data: notifData, refetch } = useQuery({
    queryKey: ['notifications', 'sos-polling'],
    queryFn: notificationsApi.getNotifications,
    refetchInterval: 15000,
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
      {/* Constrain every tab screen to a responsive column optimized for phone,
          iPad and tablet viewports without edge-to-edge stretching. */}
      <View style={[styles.appFrame, { maxWidth: maxAppWidth }]}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'web' ? 'none' : 'shift',
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
        <Tabs.Screen name="community-hub" options={{ href: null }} />
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
        <Tabs.Screen name="leadership/tickets" options={{ href: null }} />
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
    overflow: 'visible',
    zIndex: 50,
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
    overflow: 'visible',
    zIndex: 50,
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
});
