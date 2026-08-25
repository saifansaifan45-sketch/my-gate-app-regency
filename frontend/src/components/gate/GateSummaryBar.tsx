import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { theme } from '../../theme';
import { GateSummary } from '../../api/visitors';

interface GateSummaryBarProps {
  summary: GateSummary | undefined;
}

export function GateSummaryBar({ summary }: GateSummaryBarProps) {
  if (!summary) return null;

  const items: Array<{ key: string; label: string; value: number; icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = [
    { key: 'pending', label: 'Pending', value: summary.pending, icon: 'clock', color: '#B45309', bg: '#FFF7ED' },
    { key: 'approved', label: 'Approved', value: summary.approved, icon: 'check-circle', color: '#15803D', bg: '#ECFDF5' },
    { key: 'checkedIn', label: 'Inside', value: summary.checkedIn, icon: 'log-in', color: '#1D4ED8', bg: '#EFF6FF' },
    { key: 'completed', label: 'Completed', value: summary.checkedOut, icon: 'check-square', color: '#6B7280', bg: '#F3F4F6' },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={item.key} style={[styles.item, { flex: 1 }]}>
          <View style={styles.itemTop}>
            <View style={[styles.itemIcon, { backgroundColor: item.bg }]}>
              <Feather name={item.icon} size={13} color={item.color} />
            </View>
            <Text style={[styles.itemLabel, { color: item.color }]}>{item.label}</Text>
          </View>
          <Text style={[styles.itemValue, { color: item.color }]}>{item.value}</Text>
          {index < items.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  item: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
  },
  itemValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 27,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
});
