import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { Text } from './ui/Text';
import { emergencyApi } from '../api/emergency';
import { theme } from '../theme';
import { useToast } from '../store/toast';

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EmergencySOSModal({ visible, onClose }: EmergencySOSModalProps) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleClose = () => {
    if (sending) return;
    setMessage('');
    onClose();
  };

  const handleSend = async () => {
    if (message.trim().length < 3) {
      showToast({ title: 'Description required', message: 'Please describe the emergency before sending an SOS.', type: 'warning' });
      return;
    }
    setSending(true);
    try {
      await emergencyApi.create(message.trim());
      showToast({ title: 'SOS sent successfully', message: 'Your household and community escalation contacts have been notified.', type: 'success' });
      handleClose();
    } catch {
      showToast({ title: 'SOS failed to send', message: 'Please try again or contact emergency services directly.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <View style={styles.sheet}>
            <View style={styles.icon}><Feather name="alert-triangle" size={24} color="#FFFFFF" /></View>
            <Text style={styles.title}>Emergency SOS</Text>
            <Text style={styles.description}>This alerts your household, community manager, and leadership contacts.</Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the emergency"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              editable={!sending}
              autoFocus
            />
            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={handleClose} disabled={sending} style={styles.button} />
              <Button label={sending ? 'Sending SOS…' : 'Send SOS'} variant="danger" onPress={handleSend} loading={sending} style={styles.button} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  backdrop: { ...StyleSheet.absoluteFill },
  keyboardView: { width: '100%', alignItems: 'center' },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, maxWidth: 400, width: '100%', shadowColor: '#111827', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 28, elevation: 8 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#111827', marginBottom: 6 },
  description: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, color: '#6B7280', marginBottom: 18 },
  input: { minHeight: 112, borderWidth: 1, borderColor: 'rgba(20, 61, 42, 0.14)', borderRadius: 14, padding: 14, textAlignVertical: 'top', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#111827', marginBottom: 18 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1 },
});
