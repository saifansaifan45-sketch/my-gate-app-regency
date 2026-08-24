import React, { useEffect, useRef } from 'react';
import { Platform, View,
  StyleSheet,
  Animated,
  Easing,
  Dimensions, } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumPressable } from './ui/PremiumPressable';
import { Text } from './ui/Text';
import { theme } from '../theme';

interface WelcomeHomeAnimationProps {
  userId: string;
  communityId: string;
  communityName: string;
  unitNumber: string;
  firstName: string;
  onComplete: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function WelcomeHomeAnimation({
  communityName,
  unitNumber,
  firstName,
  onComplete,
}: WelcomeHomeAnimationProps) {
  const insets = useSafeAreaInsets();

  const match = unitNumber.toUpperCase().trim().match(/^([0-9]+)([A-Z])$/);
  const floorRaw = match ? parseInt(match[1], 10) : 1;
  const sideRaw = match ? match[2] : 'A';
  const floor = Math.max(1, Math.min(10, floorRaw));
  const isLeft = sideRaw === 'A';

  const floorHeight = 34;
  const targetY = -(floor - 1) * floorHeight - floorHeight / 2;
  const targetX = isLeft ? -46 : 46;
  const destinationX = isLeft ? -46 : 46;

  /*
   * Animated values — all persist for the full lifecycle.
   * Visibility is driven by opacity, never by mount/unmount.
   */
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(18)).current;
  const brandScale = useRef(new Animated.Value(0.96)).current;

  const buildingOpacity = useRef(new Animated.Value(0)).current;
  const buildingY = useRef(new Animated.Value(28)).current;
  const buildingScale = useRef(new Animated.Value(0.96)).current;

  const pathProgress = useRef(new Animated.Value(0)).current;

  const destinationGlow = useRef(new Animated.Value(0)).current;
  const destinationScale = useRef(new Animated.Value(0.8)).current;

  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeY = useRef(new Animated.Value(24)).current;
  const welcomeScale = useRef(new Animated.Value(0.96)).current;

  const skipOpacity = useRef(new Animated.Value(1)).current;

  /*
   * Derived interpolated values for the travel marker.
   * Smooth continuous curve — no 65% pause.
   */
  const dotX = pathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX],
    easing: Easing.inOut(Easing.cubic),
  });

  const dotY = pathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetY],
    easing: Easing.inOut(Easing.cubic),
  });

  /*
   * Master sequence — all phases run as one Animated.Sequence
   * with overlapping entries for crossfade. No setTimeout waits.
   */
  useEffect(() => {
    let cancelled = false;

    const hapticLight = () =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const hapticMedium = () =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const sequence = Animated.sequence([
      /* ── PHASE 1: Brand entrance ────────────────────────── */
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(brandScale, {
          toValue: 1,
          damping: 15,
          stiffness: 140,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(brandY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),

      /* ── PHASE 2: Brand → Building crossfade ────────────── */
      /* Brand fades out while building fades in simultaneously. */
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(brandY, {
          toValue: -24,
          duration: 450,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(buildingOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(buildingY, {
          toValue: 0,
          damping: 18,
          stiffness: 120,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(buildingScale, {
          toValue: 1,
          damping: 18,
          stiffness: 120,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),

      /* ── PHASE 3: Path travel ───────────────────────────── */
      Animated.timing(pathProgress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),

      /* ── PHASE 4: Destination pulse ─────────────────────── */
      /* Single clean scale bounce + single glow pulse. */
      Animated.parallel([
        Animated.sequence([
          Animated.spring(destinationScale, {
            toValue: 1.12,
            damping: 10,
            stiffness: 180,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(destinationScale, {
            toValue: 1,
            damping: 14,
            stiffness: 150,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.timing(destinationGlow, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(destinationGlow, {
            toValue: 0.7,
            duration: 300,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]),

      /* ── PHASE 5: Building → Welcome crossfade ──────────── */
      Animated.parallel([
        Animated.timing(buildingOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(buildingY, {
          toValue: -18,
          duration: 450,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(welcomeY, {
          toValue: 0,
          damping: 18,
          stiffness: 130,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(welcomeScale, {
          toValue: 1,
          damping: 18,
          stiffness: 130,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(skipOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),

      /* ── PHASE 6: Hold welcome ──────────────────────────── */
      Animated.delay(1400),

      /* ── PHASE 7: Exit ──────────────────────────────────── */
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    /* Fire haptics at key moments using listeners on animated values. */
    const brandListener = brandOpacity.addListener(({ value }) => {
      if (value > 0.5) hapticLight();
    });
    const destListener = destinationGlow.addListener(({ value }) => {
      if (value > 0.8) hapticMedium();
    });
    const welcomeListener = welcomeOpacity.addListener(({ value }) => {
      if (value > 0.5) hapticLight();
    });

    sequence.start(({ finished }) => {
      if (finished && !cancelled) onComplete();
    });

    return () => {
      cancelled = true;
      sequence.stop();
      brandOpacity.removeListener(brandListener);
      destinationGlow.removeListener(destListener);
      welcomeOpacity.removeListener(welcomeListener);
    };
  }, []);

  const handleSkip = () => onComplete();

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* SKIP */}
      <Animated.View
        style={[
          styles.skipWrapper,
          { top: insets.top + 10, opacity: skipOpacity },
        ]}
      >
        <PremiumPressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </PremiumPressable>
      </Animated.View>

      {/* BRAND — always mounted, visibility via opacity */}
      <Animated.View
        style={[
          styles.brandContainer,
          {
            opacity: brandOpacity,
            transform: [{ translateY: brandY }, { scale: brandScale }],
          },
        ]}
      >
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>R</Text>
        </View>
        <Text style={styles.brandTitle}>REGENCY SALMA</Text>
        <View style={styles.brandDivider} />
        <Text style={styles.brandSubtitle}>{communityName}</Text>
      </Animated.View>

      {/* BUILDING — always mounted, visibility via opacity */}
      <Animated.View
        style={[
          styles.buildingContainer,
          {
            opacity: buildingOpacity,
            transform: [{ translateY: buildingY }, { scale: buildingScale }],
          },
        ]}
      >
        <View style={styles.buildingHeader}>
          <Text style={styles.buildingTitle}>YOUR HOME</Text>
          <Text style={styles.buildingSubtitle}>{communityName}</Text>
        </View>

        <View style={styles.buildingGrid}>
          <View style={styles.buildingSpine} />

          {Array.from({ length: 10 }).map((_, index) => {
            const currentFloor = 10 - index;
            const isTargetFloor = currentFloor === floor;

            return (
              <View key={currentFloor} style={styles.floorRow}>
                <Text style={styles.floorNumber}>{currentFloor}</Text>

                <View
                  style={[
                    styles.room,
                    isTargetFloor && isLeft && styles.targetRoom,
                  ]}
                >
                  {isTargetFloor && isLeft && (
                    <Animated.View
                      style={[
                        styles.roomGlow,
                        {
                          opacity: destinationGlow,
                          transform: [{ scale: destinationScale }],
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.roomLabel,
                      isTargetFloor && isLeft && styles.targetRoomLabel,
                    ]}
                  >
                    A
                  </Text>
                </View>

                <View style={styles.centerShaft}>
                  <View style={styles.centerLine} />
                </View>

                <View
                  style={[
                    styles.room,
                    isTargetFloor && !isLeft && styles.targetRoom,
                  ]}
                >
                  {isTargetFloor && !isLeft && (
                    <Animated.View
                      style={[
                        styles.roomGlow,
                        {
                          opacity: destinationGlow,
                          transform: [{ scale: destinationScale }],
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.roomLabel,
                      isTargetFloor && !isLeft && styles.targetRoomLabel,
                    ]}
                  >
                    B
                  </Text>
                </View>
              </View>
            );
          })}

          {/* TRAVEL MARKER */}
          <Animated.View
            style={[
              styles.travelMarker,
              {
                transform: [{ translateX: dotX }, { translateY: dotY }],
              },
            ]}
          >
            <View style={styles.travelMarkerInner} />
          </Animated.View>

          {/* DESTINATION PIN */}
          <Animated.View
            style={[
              styles.destinationPin,
              {
                left: SCREEN_WIDTH / 2 + destinationX - 12,
                top: 10 + (10 - floor) * floorHeight - 12,
                opacity: destinationGlow,
                transform: [{ scale: destinationScale }],
              },
            ]}
          >
            <View style={styles.destinationPinDot} />
          </Animated.View>
        </View>

        <View style={styles.unitBadge}>
          <Text style={styles.unitBadgeLabel}>HOME</Text>
          <Text style={styles.unitBadgeValue}>{unitNumber}</Text>
        </View>
      </Animated.View>

      {/* WELCOME — always mounted, visibility via opacity */}
      <Animated.View
        style={[
          styles.welcomeContainer,
          {
            opacity: welcomeOpacity,
            transform: [{ translateY: welcomeY }, { scale: welcomeScale }],
          },
        ]}
      >
        <View style={styles.welcomeIcon}>
          <Text style={styles.welcomeIconText}>✓</Text>
        </View>
        <Text style={styles.welcomeEyebrow}>WELCOME HOME</Text>
        <Text style={styles.welcomeTitle}>Welcome home, {firstName}.</Text>
        <Text style={styles.welcomeBody}>
          Your home at {communityName}{'\n'}{unitNumber} is ready.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },

  /* SKIP */
  skipWrapper: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  /* BRAND — absolutely positioned, centered */
  brandContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#C79A57',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandMarkText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 21,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  brandTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 23,
    color: theme.colors.primary,
    letterSpacing: 2.4,
  },
  brandDivider: {
    width: 42,
    height: 1,
    backgroundColor: '#C79A57',
    marginVertical: 10,
  },
  brandSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    letterSpacing: 0.4,
  },

  /* BUILDING — absolutely positioned, centered */
  buildingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  buildingTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.primary,
    letterSpacing: 1.8,
  },
  buildingSubtitle: {
    marginTop: 5,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  buildingGrid: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  buildingSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(20,61,42,0.12)',
  },
  floorRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  floorNumber: {
    width: 24,
    marginRight: 8,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  room: {
    width: 48,
    height: 25,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.16)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  targetRoom: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#F7FBF8',
  },
  roomLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  targetRoomLabel: {
    color: theme.colors.primary,
  },
  roomGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 4,
    backgroundColor: 'rgba(199,154,87,0.18)',
  },
  centerShaft: {
    width: 28,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLine: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(20,61,42,0.08)',
  },

  /* TRAVEL MARKER */
  travelMarker: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 5,
  },
  travelMarkerInner: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },

  /* DESTINATION */
  destinationPin: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(199,154,87,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationPinDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#C79A57',
  },

  /* UNIT BADGE */
  unitBadge: {
    marginTop: 22,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.10)',
  },
  unitBadgeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.5,
    color: theme.colors.textSecondary,
  },
  unitBadgeValue: {
    marginTop: 2,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.primary,
  },

  /* WELCOME — absolutely positioned, centered */
  welcomeContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  welcomeIcon: {
    width: 68,
    height: 68,
    borderRadius: 32,
    backgroundColor: '#E7F2EC',
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  welcomeIconText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 30,
    color: theme.colors.primary,
  },
  welcomeEyebrow: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#C0795E',
    marginBottom: 10,
  },
  welcomeTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.7,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});