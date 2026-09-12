import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../ui/PremiumPressable';
import { theme } from '../../theme';

interface GateUnitFilterProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function GateUnitFilter({ value, onChangeText, onClear, placeholder = 'Search unit (e.g. 7B), visitor, provider...' }: GateUnitFilterProps) {
  return (
    <View style={styles.searchBox}>
      <Feather name="search" size={16} color={theme.colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      {value ? (
        <PremiumPressable onPress={onClear} hitSlop={8}>
          <Feather name="x" size={15} color={theme.colors.textSecondary} />
        </PremiumPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
});