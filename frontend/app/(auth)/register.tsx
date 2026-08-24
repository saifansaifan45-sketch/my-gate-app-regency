/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AnimatedEntrance } from '../../src/components/ui/AnimatedEntrance';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { theme } from '../../src/theme';
import { useSession } from '../../src/store/auth';
import { FormError } from '../../src/components/ui/FormError';
import { parseApiError } from '../../src/utils/api-error';

export default function RegisterScreen() {
  const router = useRouter();
  const { register: performRegister } = useSession();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Field Touched State
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Field Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validators
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'fullName': {
        const trimmed = value.trim();
        if (!trimmed) return 'Full name is required.';
        if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
        if (!/^[a-zA-Z\s]+$/.test(trimmed)) return 'Full name must contain only letters and spaces.';
        return '';
      }
      case 'email': {
        const trimmed = value.trim();
        if (!trimmed) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.';
        return '';
      }
      case 'phoneNumber': {
        const trimmed = value.trim();
        if (!trimmed) return 'Phone number is required.';
        if (!/^[0-9]+$/.test(trimmed)) return 'Phone number must contain only numbers.';
        if (trimmed.length < 10) return 'Phone number must be at least 10 digits.';
        return '';
      }
      case 'password': {
        if (!value) return 'Password is required.';
        if (value.length < 8) return 'Password must be at least 8 characters.';
        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(value)) return 'Password must contain at least one letter and one number.';
        return '';
      }
      case 'confirmPassword': {
        if (!value) return 'Please confirm your password.';
        if (value !== password) return 'Passwords do not match.';
        return '';
      }
      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (apiError) setApiError('');
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleRegister = async () => {
    // Validate all fields on submit
    const nameErr = validateField('fullName', fullName);
    const emailErr = validateField('email', email);
    const phoneErr = validateField('phoneNumber', phoneNumber);
    const passErr = validateField('password', password);
    const confirmErr = validateField('confirmPassword', confirmPassword);

    const allErrors = {
      fullName: nameErr,
      email: emailErr,
      phoneNumber: phoneErr,
      password: passErr,
      confirmPassword: confirmErr,
    };

    setTouched({
      fullName: true,
      email: true,
      phoneNumber: true,
      password: true,
      confirmPassword: true,
    });
    setErrors(allErrors);

    const hasErrors = Object.values(allErrors).some((e) => e.length > 0);
    if (hasErrors) return;

    setLoading(true);
    setApiError('');

    try {
      await performRegister({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        password,
      });
    } catch (err: any) {
      setApiError(parseApiError(err, 'Unable to create account. Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Subtle brand ambient backdrop */}
      <View pointerEvents="none" style={styles.ambientBackdrop} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand & Progress Header */}
          <AnimatedEntrance delay={30} distance={12}>
            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/auth-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTitle}>REGENCY SALMA</Text>
              <Text style={styles.brandSubtitle}>STEP 1 OF 2 · ACCOUNT IDENTITY</Text>
            </View>
          </AnimatedEntrance>

          {/* Form Card */}
          <AnimatedEntrance delay={80} distance={16}>
            <View style={styles.formCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.headerTitle}>Create your account</Text>
                <Text style={styles.headerSubtitle}>
                  Set up your personal credentials to get started.
                </Text>
              </View>

              <FormError message={apiError} />

              {/* Full Name */}
              <Input
                label="Full Name"
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChangeText={(t) => handleChange('fullName', t, setFullName)}
                onBlur={() => handleBlur('fullName', fullName)}
                error={touched.fullName ? errors.fullName : ''}
                containerStyle={styles.inputSpacing}
                autoCapitalize="words"
                autoCorrect={false}
              />

              {/* Email Address */}
              <Input
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChangeText={(t) => handleChange('email', t, setEmail)}
                onBlur={() => handleBlur('email', email)}
                error={touched.email ? errors.email : ''}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.inputSpacing}
              />

              {/* Phone Number */}
              <Input
                label="Phone Number"
                placeholder="9876543210 (digits only)"
                value={phoneNumber}
                onChangeText={(t) => handleChange('phoneNumber', t, setPhoneNumber)}
                onBlur={() => handleBlur('phoneNumber', phoneNumber)}
                error={touched.phoneNumber ? errors.phoneNumber : ''}
                keyboardType="phone-pad"
                containerStyle={styles.inputSpacing}
              />

              {/* Password */}
              <Input
                label="Password"
                placeholder="At least 8 characters (letters & numbers)"
                value={password}
                onChangeText={(t) => handleChange('password', t, setPassword)}
                onBlur={() => handleBlur('password', password)}
                error={touched.password ? errors.password : ''}
                secureTextEntry
                containerStyle={styles.inputSpacing}
              />

              {/* Confirm Password */}
              <Input
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={(t) => handleChange('confirmPassword', t, setConfirmPassword)}
                onBlur={() => handleBlur('confirmPassword', confirmPassword)}
                error={touched.confirmPassword ? errors.confirmPassword : ''}
                secureTextEntry
                containerStyle={styles.inputSpacing}
              />

              {/* Submit CTA */}
              <Button
                label={loading ? 'Creating Account...' : 'Create Account'}
                icon="arrow-right"
                iconPosition="right"
                onPress={handleRegister}
                loading={loading}
                style={styles.submitBtn}
              />
            </View>
          </AnimatedEntrance>

          {/* Footer Login Link */}
          <AnimatedEntrance delay={130} distance={10}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <PremiumPressable
                onPress={() => router.push('/(auth)/login')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.footerLink}>Log in</Text>
              </PremiumPressable>
            </View>
          </AnimatedEntrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  ambientBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F8F6F0',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    marginBottom: 10,
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  brandTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    letterSpacing: 2.2,
    color: '#143D2A',
  },
  brandSubtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#8A9A86',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.error,
    flex: 1,
    lineHeight: 18,
  },
  inputSpacing: {
    marginBottom: 14,
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 16,
    height: 62,
    borderRadius: theme.radii.pill,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.primary,
  },
});