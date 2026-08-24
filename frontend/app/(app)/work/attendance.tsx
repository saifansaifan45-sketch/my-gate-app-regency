import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkAttendanceScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 6, 26) }]}>
      <Text style={styles.title}>Attendance History</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  }
});
