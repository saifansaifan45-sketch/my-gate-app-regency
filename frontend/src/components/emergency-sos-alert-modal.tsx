import React from 'react';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { theme } from '../theme';

interface EmergencySOSAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  onAcknowledge: () => void;
}

export function EmergencySOSAlertModal({ visible, title, message, onAcknowledge }: EmergencySOSAlertModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onAcknowledge} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onAcknowledge} />
        <View style={styles.sheet}>
          <View style={styles.iconContainer}>
            <Feather name="alert-triangle" size={32} color="#DC2626" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Button label="Acknowledge & Close" onPress={onAcknowledge} style={styles.actionBtn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#DC2626',
  },
});
