import { PremiumPressable } from './ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { theme } from '../theme';

export function AvailabilityEditor() {
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.segmentedControl}>
        <PremiumPressable 
          style={[styles.segment, isAvailable && styles.segmentActive]} 
          onPress={() => setIsAvailable(true)}
        >
          <Text style={[styles.segmentText, isAvailable && styles.segmentTextActive]}>Available</Text>
        </PremiumPressable>
        <PremiumPressable 
          style={[styles.segment, !isAvailable && styles.segmentActive]} 
          onPress={() => setIsAvailable(false)}
        >
          <Text style={[styles.segmentText, !isAvailable && styles.segmentTextActive]}>Unavailable</Text>
        </PremiumPressable>
      </View>

      {isAvailable ? (
        <View style={styles.statusBox}>
          <View style={styles.dotGreen} />
          <Text style={styles.statusText}>You are currently available.</Text>
        </View>
      ) : (
        <View style={styles.editorBox}>
          <Text style={styles.editorLabel}>Mark as unavailable</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Start</Text>
              <Text style={styles.dateValue}>18 Aug, 6:00 PM</Text>
            </View>
            <Feather name="arrow-right" size={16} color={theme.colors.textSecondary} />
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>End</Text>
              <Text style={styles.dateValue}>20 Aug, 9:00 AM</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <PremiumPressable style={styles.clearBtn} onPress={() => setIsAvailable(true)}>
              <Text style={styles.clearBtnText}>Clear dates</Text>
            </PremiumPressable>
            <PremiumPressable style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save availability</Text>
            </PremiumPressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F9F7F2',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.textPrimary,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 10,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginRight: 10,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.primary,
  },
  editorBox: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 10,
  },
  editorLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.accent,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 6,
  },
  dateLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 18,
    backgroundColor: '#FFF',
  },
  clearBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  saveBtn: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFF',
  }
});
