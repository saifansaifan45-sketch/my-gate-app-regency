import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { cardSurface, cardSystem } from './cardSystem';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, style, ...props }: CardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    padding: cardSystem.padding,
  },
});
