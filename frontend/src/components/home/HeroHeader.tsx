/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { TimePeriod, getTimeGreeting } from './TimeBasedBackground';

interface HeroHeaderProps {
  displayName: string;
  period: TimePeriod;
  topInset: number;
  onNotificationPress: () => void;
  onProfilePress: () => void;
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  displayName,
  period,
  topInset,
  onNotificationPress,
  onProfilePress,
}) => {
  const greeting = getTimeGreeting(period);
  const avatarLetter = (displayName.charAt(0) || 'R').toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: Math.max(topInset, 16) }]}>
      {/* Brand and account controls remain anchored to the existing hero. */}
      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/regency-salma-typographic-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.topRightActions}>
          <PremiumPressable
            style={styles.bellButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onNotificationPress}
            scaleTo={0.92}
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={20} color="#111827" />
            <View style={styles.unreadDot} />
          </PremiumPressable>

          <PremiumPressable
            style={styles.avatarButton}
            onPress={onProfilePress}
            scaleTo={0.92}
            accessibilityLabel="Profile"
          >
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </PremiumPressable>
        </View>
      </View>

      {/* The resident identity is deliberately the hero's strongest moment. */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingBadge}>
          <Text style={styles.greetingSubtitle}>{greeting}</Text>
        </View>
        <Text style={styles.residentName}>{displayName}</Text>
        <Text style={styles.supportingCopy}>
          Welcome back. Here&apos;s what&apos;s happening in your community.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: '#C98B45',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#143D2A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1F16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  greetingSection: {
    maxWidth: 340,
    marginBottom: 10,
  },
  greetingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 98,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#0B2118',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  greetingSubtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  residentName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 36,
    lineHeight: 43,
    color: '#FFFFFF',
    letterSpacing: -0.9,
    textShadowColor: 'rgba(11, 31, 22, 0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  supportingCopy: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: -0.1,
    marginTop: 8,
    maxWidth: 300,
  },
});
