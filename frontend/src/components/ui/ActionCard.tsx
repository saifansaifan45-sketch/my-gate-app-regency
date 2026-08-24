import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PremiumPressable } from './PremiumPressable';
import { Text } from './Text';
import { cardSurface, cardSystem } from './cardSystem';
import { theme } from '../../theme';

interface ActionCardProps {
  icon: React.ReactNode;
  iconBackground: string;
  title: string;
  description: string;
  supportingLabel: string;
  onPress?: () => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  trailing?: React.ReactNode;
}

/**
 * Standard destination card for Services and Profile. Content may change, but
 * its 52px icon, three-line text rhythm and trailing affordance never do.
 */
export function ActionCard({
  icon,
  iconBackground,
  title,
  description,
  supportingLabel,
  onPress,
  accentColor = theme.colors.primary,
  style,
  trailing,
}: ActionCardProps) {
  return (
    <PremiumPressable
      style={[styles.card, style]}
      onPress={onPress}
      scaleTo={onPress ? 0.98 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${title}. ${description}` : undefined}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: accentColor }]} numberOfLines={1}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        <Text style={[styles.supportingLabel, { color: accentColor }]} numberOfLines={1}>{supportingLabel}</Text>
      </View>
      {trailing || <Feather name="chevron-right" size={20} color={accentColor} />}
    </PremiumPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    minHeight: cardSystem.actionHeight,
    padding: cardSystem.padding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: cardSystem.iconSize,
    height: cardSystem.iconSize,
    borderRadius: cardSystem.iconRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: cardSystem.title,
  description: {
    ...cardSystem.description,
    marginTop: 3,
  },
  supportingLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
});
