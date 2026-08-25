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

export function GateUnitFilter({ value, onChangeText, onClear, placeholder = 'Filter by unit (e.g. 7B)' }: GateUnitFilterProps) {
  return (
    <View style={styles.searchBox}>
      <Feather name="search" size={16} color={theme.colors.textSecondary} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="characters"
      />
      {value ? (
        <PremiumPressable onPress={onClear} hitSlop={8}>
          <Feather name="x" size={14} color={theme.colors.textSecondary} />
        </PremiumPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
});