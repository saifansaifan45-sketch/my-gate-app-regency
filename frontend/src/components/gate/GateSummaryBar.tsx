import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { GateSummary } from '../../api/visitors';

interface GateSummaryBarProps {
  summary: GateSummary | undefined;
}

export function GateSummaryBar({ summary }: GateSummaryBarProps) {
  if (!summary) return null;

  const items: Array<{ key: string; label: string; value: number; icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = [
    { key: 'pending', label: 'Pending', value: summary.pending, icon: 'clock', color: '#C2410C', bg: '#FFF7ED' },
    { key: 'approved', label: 'Expected', value: summary.approved, icon: 'check-circle', color: '#047857', bg: '#ECFDF5' },
    { key: 'checkedIn', label: 'Inside', value: summary.checkedIn, icon: 'log-in', color: '#1D4ED8', bg: '#EFF6FF' },
    { key: 'completed', label: 'Done', value: summary.checkedOut, icon: 'archive', color: '#475569', bg: '#F8FAFC' },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          <View style={styles.item}>
            <View style={styles.itemTop}>
              <View style={[styles.itemIcon, { backgroundColor: item.bg }]}>
                <Feather name={item.icon} size={12} color={item.color} />
              </View>
              <Text style={[styles.itemLabel, { color: item.color }]}>{item.label}</Text>
            </View>
            <Text style={[styles.itemValue, { color: item.color }]}>{item.value}</Text>
          </View>
          {index < items.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  itemIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  itemValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
});
