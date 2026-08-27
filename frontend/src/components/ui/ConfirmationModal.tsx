import React from 'react';
import { Modal, StyleSheet, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';

type ConfirmationVariant = 'default' | 'danger' | 'warning';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  loading?: boolean;
  confirmIcon?: React.ComponentProps<typeof Feather>['name'];
}

const VARIANT_STYLES: Record<ConfirmationVariant, {
  iconBg: string;
  iconName: React.ComponentProps<typeof Feather>['name'];
  confirmVariant: 'primary' | 'danger' | 'dangerOutline';
}> = {
  default: {
    iconBg: '#143D2A',
    iconName: 'info',
    confirmVariant: 'primary' as const,
  },
  danger: {
    iconBg: '#DC2626',
    iconName: 'alert-triangle',
    confirmVariant: 'danger' as const,
  },
  warning: {
    iconBg: '#D97706',
    iconName: 'alert-triangle',
    confirmVariant: 'dangerOutline' as const,
  },
};

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  confirmIcon,
}: ConfirmationModalProps) {
  const variantStyles = VARIANT_STYLES[variant];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modal}>
          <View style={[styles.iconContainer, { backgroundColor: variantStyles.iconBg }]}>
            <Feather name={confirmIcon || variantStyles.iconName} size={24} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <Button
              label={cancelLabel}
              variant="outline"
              size="md"
              onPress={onClose}
              disabled={loading}
              style={styles.cancelBtn}
            />
            <Button
              label={confirmLabel}
              variant={variantStyles.confirmVariant}
              size="md"
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  cancelBtn: {
    borderRadius: 100,
  },
  confirmBtn: {
    borderRadius: 100,
  },
});
