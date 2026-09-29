import React, { useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { Animated, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from '../../theme';
import { AnimatedEntrance } from './AnimatedEntrance';
import { cardSurface } from './cardSystem';

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const scale = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 180, mass: 0.7, useNativeDriver: true }).start();
  }, [scale]);
  const accent = iconAccent(icon);
  return (
    <AnimatedEntrance delay={200}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Animated.View style={[styles.iconWrap, { backgroundColor: accent.backgroundColor, transform: [{ scale }] }]}>
            <Feather name={icon} size={28} color={accent.color} />
          </Animated.View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {actionLabel && onAction ? <Text onPress={onAction} style={styles.action}>{actionLabel}</Text> : null}
        </View>
      </View>
    </AnimatedEntrance>
  );
}

function iconAccent(icon: keyof typeof Feather.glyphMap) {
  if (icon === 'heart' || icon === 'star') return { backgroundColor: '#FCE7F3', color: '#BE185D' };
  if (icon === 'truck' || icon === 'package') return { backgroundColor: '#FFF3D6', color: '#B45309' };
  if (icon === 'calendar' || icon === 'clock') return { backgroundColor: '#E0F2FE', color: '#0369A1' };
  if (icon === 'alert-circle' || icon === 'slash') return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  return { backgroundColor: '#E8F5E9', color: theme.colors.primary };
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  card: {
    ...cardSurface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  iconWrap: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  description: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  action: { marginTop: 16, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.primary },
});
