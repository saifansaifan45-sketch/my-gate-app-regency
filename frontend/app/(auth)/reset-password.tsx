import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { theme } from '../../src/theme';
import { api } from '../../src/api/client';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to reset password. The token may be expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {success ? (
            <View style={{ alignItems: 'center' }}>
              <View style={styles.successIcon}><Feather name="check" size={32} color={theme.colors.success} /></View>
              <Text style={styles.title}>Password Reset Complete</Text>
              <Text style={styles.subtitle}>Your password has been changed securely. You can now log in.</Text>
              <Button label="Go to Login" onPress={() => router.replace('/login')} style={{ marginTop: 24, width: '100%' }} />
            </View>
          ) : (
            <View>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>Please choose a strong password with at least 8 characters.</Text>
              
              {errorMsg ? <Text style={styles.errorBanner}>{errorMsg}</Text> : null}
              
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min 8 characters"
                />
                <Feather name={showNew ? "eye" : "eye-off"} size={20} color={theme.colors.textSecondary} style={styles.eyeIcon} onPress={() => setShowNew(!showNew)} />
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                />
                <Feather name={showConfirm ? "eye" : "eye-off"} size={20} color={theme.colors.textSecondary} style={styles.eyeIcon} onPress={() => setShowConfirm(!showConfirm)} />
              </View>

              <Button
                label="Reset Password"
                onPress={handleSubmit}
                disabled={submitting || !canSubmit}
                loading={submitting}
                style={{ marginTop: 24 }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 28, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#F9FAFB' },
  input: { flex: 1, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: theme.colors.textPrimary },
  eyeIcon: { paddingHorizontal: 16 },
  errorBanner: { color: theme.colors.error, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, marginBottom: 16, textAlign: 'center' }
});
