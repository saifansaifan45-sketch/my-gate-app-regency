import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { PremiumPressable } from './PremiumPressable';
import { theme } from '../../theme';
import { smartBack } from '../../navigation/history';

export type HeaderVariant = 'home' | 'subscreen' | 'tabroot';

export interface AppHeaderProps {
  variant?: HeaderVariant;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  showNotification?: boolean;
  showAvatar?: boolean;
  firstName?: string;
  hasUnreadNotifications?: boolean;
}

export function AppHeader({
  variant = 'subscreen',
  title,
  subtitle,
  showBack,
  onBackPress,
  rightAction,
  showNotification = true,
  showAvatar = true,
  firstName = 'Resident',
  hasUnreadNotifications = true,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    smartBack(router, '/(app)/home');
  };

  const isHome = variant === 'home';
  const isTabRoot = variant === 'tabroot';
  const shouldShowBack = showBack ?? (!isHome && !isTabRoot);

  return (
    <View style={[styles.headerWrapper, { paddingTop: Math.max(insets.top, 14) }]}>
      <View style={styles.headerContent}>
        {/* Home Variant: Centered Typographic Logo */}
        {isHome ? (
          <>
            <View style={styles.headerSideSlot} />

            <View style={styles.centeredLogoContainer}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../../../assets/regency-salma-typographic-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={[styles.headerSideSlot, styles.headerRight]}>
              {showNotification && (
                <PremiumPressable
                  style={styles.bellIconContainer}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => router.push('/notifications')}
                >
                  <Feather name="bell" size={22} color={theme.colors.textPrimary} />
                  {hasUnreadNotifications && <View style={styles.unreadDot} />}
                </PremiumPressable>
              )}

              {showAvatar && (
                <PremiumPressable
                  style={styles.avatarPlaceholder}
                  onPress={() => router.push('/profile')}
                >
                  <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
                </PremiumPressable>
              )}
            </View>
          </>
        ) : (
          /* Subscreen & TabRoot Variants */
          <>
            <View style={styles.leftContainer}>
              {shouldShowBack && (
                <PremiumPressable
                  onPress={handleBack}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.backButton}
                >
                  <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                </PremiumPressable>
              )}

              {title ? (
                <View style={styles.titleColumn}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.rightContainer}>
              {rightAction ? (
                rightAction
              ) : isTabRoot && showNotification ? (
                <PremiumPressable
                  style={styles.bellIconContainer}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => router.push('/notifications')}
                >
                  <Feather name="bell" size={22} color={theme.colors.textPrimary} />
                  {hasUnreadNotifications && <View style={styles.unreadDot} />}
                </PremiumPressable>
              ) : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    position: 'relative',
  },
  headerSideSlot: {
    width: 76,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    justifyContent: 'flex-end',
  },
  centeredLogoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  logoImage: {
    width: 140,
    height: 40,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  backButton: {
    marginRight: 14,
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bellIconContainer: {
    position: 'relative',
    marginRight: 14,
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(20, 61, 42, 0.15)',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
