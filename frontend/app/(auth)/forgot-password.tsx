import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Platform, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { theme } from '../../src/theme';
import { api } from '../../src/api/client';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg('Failed to process request. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PremiumPressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </PremiumPressable>

        <View style={styles.card}>
          {success ? (
            <View style={{ alignItems: 'center' }}>
              <View style={styles.successIcon}><Feather name="mail" size={32} color={theme.colors.success} /></View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>If {email} matches an account, we have sent a password reset link.</Text>
              <Button label="Return to Login" onPress={() => router.back()} style={{ marginTop: 24, width: '100%' }} />
            </View>
          ) : (
            <View>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter your email address and we'll send you a link to reset your password.</Text>
              
              {errorMsg ? <Text style={styles.errorBanner}>{errorMsg}</Text> : null}

              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                label="Send Reset Link"
                onPress={handleSubmit}
                disabled={submitting || !email.includes('@')}
                loading={submitting}
                style={{ marginTop: 20 }}
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
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', padding: 28, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary, marginBottom: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, backgroundColor: '#F9FAFB' },
  errorBanner: { color: theme.colors.error, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, marginBottom: 16, textAlign: 'center' }
});
