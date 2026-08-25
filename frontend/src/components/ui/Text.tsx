import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';
import { theme } from '../../theme';

interface TextProps extends RNTextProps {
  variant?: keyof typeof theme.typography;
}

export function Text({ style, variant = 'body', ...props }: TextProps) {
  return (
    <RNText style={[styles.base, theme.typography[variant], style]} {...props} />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    paddingBottom: Platform.select({ android: 2, ios: 1, default: 1 }),
  },
});
