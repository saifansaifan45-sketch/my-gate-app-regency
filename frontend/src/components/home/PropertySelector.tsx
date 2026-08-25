import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';

interface PropertySelectorProps {
  unitNumber?: string;
  onPress: () => void;
}

export const PropertySelector: React.FC<PropertySelectorProps> = ({ unitNumber, onPress }) => {
  const displayUnit = unitNumber ? `${unitNumber} • My Home` : 'Select Home';

  return (
    <View style={styles.wrapper}>
      <PremiumPressable
        style={styles.pillContainer}
        onPress={onPress}
        scaleTo={0.96}
        accessibilityRole="button"
        accessibilityLabel={`Selected property: ${displayUnit}`}
      >
        <View style={styles.homeIconContainer}>
          <Feather name="home" size={16} color="#DC2626" />
        </View>
        <Text style={styles.unitText}>{displayUnit}</Text>
        <Feather name="chevron-right" size={16} color="#6B7280" style={styles.chevron} />
      </PremiumPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    // The raised dashboard sheet overlaps the hero; this leaves a compact breathing gap below the selector.
    marginBottom: 36,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 98,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  homeIconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
    letterSpacing: -0.2,
    marginRight: 10,
    includeFontPadding: false,
  },
  chevron: {
    marginLeft: 2,
  },
});
