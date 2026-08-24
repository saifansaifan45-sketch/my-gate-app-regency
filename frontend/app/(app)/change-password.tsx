import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { api } from '../../src/api/client';
import { smartBack } from '../../src/navigation/history';
import { useToast } from '../../src/store/toast';
import { useSession } from '../../src/store/auth';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { logout } = useSession();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = currentPassword && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg('');
    
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      
      showToast({ title: 'Success', message: 'Password changed successfully. Please log in again.', type: 'success' });
      await logout();
      router.replace('/login');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Change Password" onBackPress={() => smartBack(router, '/profile-settings')} />
      <ScrollView contentContainerStyle={styles.content}>
        
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Feather 
              name={showCurrent ? "eye" : "eye-off"} 
              size={20} 
              color={theme.colors.textSecondary} 
              style={styles.eyeIcon}
              onPress={() => setShowCurrent(!showCurrent)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min 8 characters"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Feather 
              name={showNew ? "eye" : "eye-off"} 
              size={20} 
              color={theme.colors.textSecondary} 
              style={styles.eyeIcon}
              onPress={() => setShowNew(!showNew)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Feather 
              name={showConfirm ? "eye" : "eye-off"} 
              size={20} 
              color={theme.colors.textSecondary} 
              style={styles.eyeIcon}
              onPress={() => setShowConfirm(!showConfirm)}
            />
          </View>
        </View>

        <Button
          label="Change Password"
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          style={styles.btn}
        />
        <Text style={styles.infoText}>Changing your password will sign you out of all devices.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: cardSystem.pagePadding, gap: 20 },
  errorText: { color: theme.colors.error, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, marginBottom: 8 },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textPrimary },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12 },
  input: { flex: 1, height: 52, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: theme.colors.textPrimary },
  eyeIcon: { paddingHorizontal: 16 },
  btn: { marginTop: 12 },
  infoText: { textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary, marginTop: -4 }
});
