import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';

export type AvailabilityStatus = 'AVAILABLE' | 'AWAY' | 'HOLIDAY' | 'DO_NOT_DISTURB';

const LABELS: Record<AvailabilityStatus, string> = { AVAILABLE: 'Available', AWAY: 'Away', HOLIDAY: 'Holiday', DO_NOT_DISTURB: 'Do not disturb' };
const COLORS: Record<AvailabilityStatus, { background: string; text: string; dot: string }> = {
  AVAILABLE: { background: '#E8F5E9', text: '#176B3A', dot: '#2E9B57' },
  AWAY: { background: '#FFF4E5', text: '#9A5B00', dot: '#D98914' },
  HOLIDAY: { background: '#EAF2FF', text: '#245A9A', dot: '#4C82D1' },
  DO_NOT_DISTURB: { background: '#FDECEC', text: '#A53B3B', dot: '#C95858' },
};

export function AvailabilityBadge({ status, compact = false }: { status?: AvailabilityStatus | null; compact?: boolean }) {
  if (!status) return null;
  const palette = COLORS[status];
  return <View accessible accessibilityLabel={`Availability: ${LABELS[status]}`} style={[styles.badge, { backgroundColor: palette.background }, compact && styles.compact]}>
    <View style={[styles.dot, { backgroundColor: palette.dot }]} />
    <Text style={[styles.label, { color: palette.text }, compact && styles.compactLabel]}>{LABELS[status]}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  compact: { gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  compactLabel: { fontSize: 10 },
});
