import { PremiumPressable } from './PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
  FocusEvent,
  BlurEvent,
} from 'react-native';
import { Text } from './Text';
import { theme } from '../../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Input({
  label,
  error,
  style,
  containerStyle,
  inputStyle,
  secureTextEntry,
  textContentType,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: BlurEvent) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
      >
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry={isSecure}
          textContentType={textContentType ?? (isSecure ? 'none' : undefined)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {secureTextEntry && (
          <PremiumPressable
            style={styles.eyeIcon}
            onPress={() => setIsSecure(!isSecure)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={isSecure ? 'eye-off' : 'eye'}
              size={20}
              color={
                isFocused ? theme.colors.primary : theme.colors.textSecondary
              }
            />
          </PremiumPressable>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 22,
  },
  label: {
    marginBottom: 8,
    color: theme.colors.textPrimary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
  },
  inputWrapper: {
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  inputFocused: {
    borderColor: theme.colors.focus,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 18,
    color: theme.colors.textPrimary,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  eyeIcon: {
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 6,
  },
});
