import React from 'react';
import { View, StyleSheet, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { theme } from '../../theme';

interface OTPInputModalProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  visitorName: string;
  isPending?: boolean;
}

export function OTPInputModal({ visible, onClose, onVerify, visitorName, isPending }: OTPInputModalProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} onStartShouldSetResponder={() => true}>
      <View style={styles.backdrop} onTouchStart={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code shared by <Text style={{ fontWeight: '600' }}>{visitorName}</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="Enter OTP"
              onChangeText={(v) => onVerify(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
          </View>
          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={isPending ? 'Verifying...' : 'Verify & Check In'}
              variant="primary"
              size="md"
              onPress={onClose}
              disabled={isPending}
              loading={isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  keyboardView: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  otpInput: {
    height: 56,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: theme.colors.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
