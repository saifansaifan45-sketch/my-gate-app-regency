import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';

export function ProgressDots({
  count,
  activeIndex,
  style,
}: {
  count: number;
  activeIndex: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, style]}>
      {Array.from({length: count}).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex && styles.activeDot]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.l,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: theme.colors.border,
  },
  activeDot: {
    backgroundColor: theme.colors.accent,
  },
});
