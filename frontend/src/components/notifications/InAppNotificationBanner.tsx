import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { theme } from '../../theme';
import { pushNotifications, NotificationPayload } from '../../services/pushNotifications';

export function InAppNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentNotification, setCurrentNotification] = useState<NotificationPayload | null>(null);

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCurrentNotification(null);
    });
  }, [opacity, translateY]);

  const showNotification = useCallback(
    (notif: NotificationPayload) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setCurrentNotification(notif);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 120,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        dismiss();
      }, 5000);
    },
    [dismiss, opacity, translateY]
  );

  useEffect(() => {
    const unsub = pushNotifications.onNotificationReceived((notif) => {
      showNotification(notif);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showNotification]);

  if (!currentNotification) {
    return null;
  }

  const handlePress = () => {
    dismiss();
    const { type, data } = currentNotification;
    if (type === 'CHAT_MESSAGE') {
      router.push('/chat');
    } else if (type === 'GATE_ARRIVAL') {
      router.push('/visitors');
    } else if (type === 'EMERGENCY_SOS') {
      router.push('/home');
    } else if (data?.url && typeof data.url === 'string') {
      router.push(data.url as never);
    } else {
      router.push('/notifications');
    }
  };

  const getIconAndColors = () => {
    switch (currentNotification.type) {
      case 'GATE_ARRIVAL':
        return {
          icon: 'shield',
          iconBg: theme.colors.surfaceGreen,
          iconColor: theme.colors.primary,
          badgeBg: '#E7F3EA',
          badgeText: 'Gate Arrival',
        };
      case 'CHAT_MESSAGE':
        return {
          icon: 'message-circle',
          iconBg: '#EAF2F8',
          iconColor: '#245C86',
          badgeBg: '#EAF2F8',
          badgeText: 'Community Chat',
        };
      case 'EMERGENCY_SOS':
        return {
          icon: 'alert-triangle',
          iconBg: '#FDECEA',
          iconColor: theme.colors.error,
          badgeBg: '#FDECEA',
          badgeText: 'Urgent SOS',
        };
      default:
        return {
          icon: 'bell',
          iconBg: '#FFF3DE',
          iconColor: '#875200',
          badgeBg: '#FFF3DE',
          badgeText: 'Notice',
        };
    }
  };

  const { icon, iconBg, iconColor, badgeBg, badgeText } = getIconAndColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Math.max(insets.top, 12) + 4,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <PremiumPressable style={styles.card} onPress={handlePress} scaleTo={0.98}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={iconColor} />
        </View>

        <View style={styles.textWrap}>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeLabel, { color: iconColor }]}>{badgeText}</Text>
            </View>
            <Text style={styles.timeText}>Just now</Text>
          </View>
          <Text style={styles.titleText} numberOfLines={1}>
            {currentNotification.title}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {currentNotification.body}
          </Text>
        </View>

        <PremiumPressable style={styles.dismissBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color={theme.colors.textTertiary} />
        </PremiumPressable>
      </PremiumPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    maxWidth: 600,
    alignSelf: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E9E2',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  titleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
});
