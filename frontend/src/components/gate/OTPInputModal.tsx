import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Platform, KeyboardAvoidingView, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../ui/PremiumPressable';
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
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!visible) setOtp('');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.iconWrap}>
                <Feather name="shield" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Verify OTP Code</Text>
                <Text style={styles.subtitle}>
                  {'Enter the 6-digit code for '}
                  <Text style={styles.boldName}>{visitorName || 'Guest'}</Text>
                </Text>
              </View>
              <PremiumPressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Feather name="x" size={16} color={theme.colors.textSecondary} />
              </PremiumPressable>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor="#9CA3AF"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
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
                onPress={() => onVerify(otp)}
                disabled={isPending || otp.length !== 6}
                loading={isPending}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF4EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16.5,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  boldName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.textPrimary,
  },
  inputContainer: {
    marginBottom: 18,
  },
  otpInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#D1E3D7',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
    color: theme.colors.primary,
    backgroundColor: '#F8FAF9',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
