import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { theme } from '../../theme';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'error' | 'warning';
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG = {
  success: {
    icon: 'check-circle' as const,
    iconColor: '#10B981',
    borderColor: '#D1FAE5',
    bgColor: '#FFFFFF',
    indicatorColor: '#10B981',
  },
  info: {
    icon: 'info' as const,
    iconColor: '#3B82F6',
    borderColor: '#DBEAFE',
    bgColor: '#FFFFFF',
    indicatorColor: '#3B82F6',
  },
  warning: {
    icon: 'alert-triangle' as const,
    iconColor: '#F59E0B',
    borderColor: '#FEF3C7',
    bgColor: '#FFFFFF',
    indicatorColor: '#F59E0B',
  },
  error: {
    icon: 'x-circle' as const,
    iconColor: '#EF4444',
    borderColor: '#FEE2E2',
    bgColor: '#FFFFFF',
    indicatorColor: '#EF4444',
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.success;
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 160,
        mass: 0.8,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 160,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -40,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          borderColor: config.borderColor,
          backgroundColor: config.bgColor,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={[styles.indicator, { backgroundColor: config.indicatorColor }]} />
      <View style={styles.contentRow}>
        <View style={[styles.iconContainer, { backgroundColor: `${config.iconColor}14` }]}>
          <Feather name={config.icon} size={18} color={config.iconColor} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.message ? <Text style={styles.toastMessage}>{toast.message}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Feather name="x" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: Math.max(insets.top, 12) + 8 }]}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    gap: 8,
  },
  toastCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  indicator: {
    height: 3,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  toastTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  toastMessage: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  closeBtn: {
    width: 44,
    height: 44,
    marginTop: -10,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
