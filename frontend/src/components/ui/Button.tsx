import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacityProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { theme } from '../../theme';
import { PremiumPressable } from './PremiumPressable';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface ButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerOutline';
  size?: 'sm' | 'md' | 'lg';
  icon?: FeatherName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

const SIZES = {
  sm: { minHeight: 40, fontSize: 13, iconSize: 14, radius: 100, paddingVertical: 9 },
  md: { minHeight: 44, fontSize: 14, iconSize: 16, radius: 100, paddingVertical: 10 },
  lg: { minHeight: 48, fontSize: 15, iconSize: 18, radius: 100, paddingVertical: 12 },
};

export function Button({ label, variant = 'primary', size = 'md', icon, iconPosition = 'left', loading, style, disabled, ...props }: ButtonProps) {
  const dims = SIZES[size];
  const palette = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <PremiumPressable
      style={[
        styles.base,
        { minHeight: dims.minHeight, borderRadius: dims.radius, paddingVertical: dims.paddingVertical },
        palette.container,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      scaleTo={0.97}
      activeOpacity={0.9}
      {...(props as any)}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <Feather name={icon} size={dims.iconSize} color={palette.textColor} style={{ marginRight: 8 }} />}
          <Text style={[styles.label, { fontSize: dims.fontSize, color: palette.textColor }]}>{label}</Text>
          {icon && iconPosition === 'right' && <Feather name={icon} size={dims.iconSize} color={palette.textColor} style={{ marginLeft: 8 }} />}
        </>
      )}
    </PremiumPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  outline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.22)',
  },
  danger: {
    backgroundColor: theme.status.danger.foreground,
    shadowColor: theme.status.danger.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  dangerOutline: {
    backgroundColor: theme.status.danger.background,
    borderWidth: 1,
    borderColor: theme.status.danger.border,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: -0.2,
  },
});

const VARIANTS = {
  primary: { container: styles.primary, textColor: theme.colors.onPrimary },
  secondary: { container: styles.secondary, textColor: theme.colors.textPrimary },
  outline: { container: styles.outline, textColor: theme.colors.primary },
  danger: { container: styles.danger, textColor: theme.colors.onPrimary },
  dangerOutline: { container: styles.dangerOutline, textColor: theme.status.danger.foreground },
};
