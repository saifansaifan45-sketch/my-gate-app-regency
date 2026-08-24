import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';

interface FormErrorProps {
  message?: string | null;
  style?: StyleProp<ViewStyle>;
  icon?: React.ComponentProps<typeof Feather>['name'];
}

export function FormError({ message, style, icon = 'alert-circle' }: FormErrorProps) {
  if (!message || message.trim().length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <Feather name={icon} size={16} color="#DC2626" style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 10,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 18,
  },
});
