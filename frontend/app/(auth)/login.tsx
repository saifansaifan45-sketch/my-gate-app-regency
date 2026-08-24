/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { theme } from '../../src/theme';
import { useSession } from '../../src/store/auth';
import { shadowBox } from '../../src/utils/shadow';

import { FormError } from '../../src/components/ui/FormError';
import { parseApiError } from '../../src/utils/api-error';

const LOGO_WIDTH = 160;
const LOGO_HEIGHT = LOGO_WIDTH * (941 / 1672);
const TOP_PADDING = 36;

let introHasPlayed = false;

interface FormContentProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  errorMsg: string;
  setErrorMsg: (v: string) => void;
  touched: Record<string, boolean>;
  setTouched: (v: Record<string, boolean>) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (v: Record<string, string>) => void;
  handleLogin: () => void;
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}

function FormContent({ email, setEmail, password, setPassword, errorMsg, setErrorMsg, touched, setTouched, fieldErrors, setFieldErrors, handleLogin, loading, router }: FormContentProps) {
  const validateEmail = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (v: string) => {
    if (!v) return 'Password is required.';
    return '';
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched({ ...touched, [field]: true });
    if (field === 'email') {
      setFieldErrors({ ...fieldErrors, email: validateEmail(email) });
    } else if (field === 'password') {
      setFieldErrors({ ...fieldErrors, password: validatePassword(password) });
    }
  };

  return (
    <>
      <FormError message={errorMsg} />

      <Input
        label="Email address"
        placeholder="Enter your email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (errorMsg) setErrorMsg('');
          if (touched.email) setFieldErrors({ ...fieldErrors, email: validateEmail(t) });
        }}
        onBlur={() => handleBlur('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={touched.email ? fieldErrors.email : undefined}
      />

      <View style={styles.passwordField}>
        <View style={styles.passwordHeader}>
          <Text variant="label" style={styles.passwordLabel}>
            Password
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.forgotButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <Input
          label=""
          placeholder="Enter your password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (errorMsg) setErrorMsg('');
            if (touched.password) setFieldErrors({ ...fieldErrors, password: validatePassword(t) });
          }}
          onBlur={() => handleBlur('password')}
          error={touched.password ? fieldErrors.password : undefined}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Button
        label="Login"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        style={styles.loginButton}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Don't have an account?{' '}
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.createAccountText}>
            Register
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login: performLogin } = useSession();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loginSucceeded, setLoginSucceeded] = useState(false);

  // Touched and validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateEmail = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (v: string) => {
    if (!v) return 'Password is required.';
    return '';
  };

  const logoProgress = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTravel = useRef(new Animated.Value(20)).current;

  // Login success transition values
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const logoSuccessScale = useRef(new Animated.Value(1)).current;
  const screenFade = useRef(new Animated.Value(0)).current;

  const finalLogoTop = insets.top + TOP_PADDING;
  const centeredLogoTop = (height - LOGO_HEIGHT) / 2;
  const logoStartOffset = centeredLogoTop - finalLogoTop;

  const logoTravel = logoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [logoStartOffset, 0],
  });

  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const playIntro = () => {
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
      }
      pulseRef.current?.stop();

      logoOpacity.setValue(0);
      logoProgress.setValue(0);
      logoPulse.setValue(1);
      titleOpacity.setValue(0);
      subtitleOpacity.setValue(0);
      formOpacity.setValue(0);
      formTravel.setValue(20);

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulse, {
            toValue: 1.16,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(logoPulse, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );

      pulseRef.current = pulse;
      pulse.start();

      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      introTimerRef.current = setTimeout(() => {
        pulse.stop();

        Animated.parallel([
          Animated.spring(logoProgress, {
            toValue: 1,
            damping: 18,
            stiffness: 110,
            mass: 0.9,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(logoPulse, {
            toValue: 1,
            damping: 18,
            stiffness: 110,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start(() => {
          Animated.sequence([
            Animated.timing(titleOpacity, {
              toValue: 1,
              duration: 350,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(subtitleOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.parallel([
              Animated.timing(formOpacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: Platform.OS !== 'web',
              }),
              Animated.spring(formTravel, {
                toValue: 0,
                damping: 18,
                stiffness: 120,
                useNativeDriver: Platform.OS !== 'web',
              }),
            ]),
          ]).start();
        });
      }, 1300);
    };

    const setFinalState = () => {
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
      }
      pulseRef.current?.stop();

      logoOpacity.setValue(1);
      logoProgress.setValue(1);
      logoPulse.setValue(1);
      titleOpacity.setValue(1);
      subtitleOpacity.setValue(1);
      formOpacity.setValue(1);
      formTravel.setValue(0);
    };

    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev !== 'active' && next === 'active') {
        introHasPlayed = true;
        playIntro();
      }
    });

    if (!introHasPlayed) {
      introHasPlayed = true;
      playIntro();
    } else {
      setFinalState();
    }

    return () => {
      subscription.remove();
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
      }
      pulseRef.current?.stop();
    };
  }, []);

  const playSuccessAnimation = () => {
    return new Promise<void>((resolve) => {
      Animated.sequence([
        // Phase 1 — Success confirmation (~700ms)
        Animated.parallel([
          Animated.timing(successOpacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(successScale, {
            toValue: 1,
            friction: 7,
            tension: 110,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(checkmarkScale, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        // Hold so the confirmation reads clearly
        Animated.delay(300),
        // Phase 2 — Premium transition (~1100ms)
        Animated.parallel([
          Animated.timing(contentFade, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(logoSuccessScale, {
            toValue: 1.05,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(screenFade, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        // Phase 3 — final settle before navigation
        Animated.delay(350),
      ]).start(() => resolve());
    });
  };

  const handleLogin = async () => {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr, password: passErr });

    if (emailErr || passErr) {
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      // Authenticate + store tokens, but defer navigation so the success
      // transition can complete before entering the app.
      await performLogin(
        {
          email: email.trim().toLowerCase(),
          password,
        },
        { navigate: false },
      );
    } catch (err: unknown) {
      setErrorMsg(parseApiError(err, 'Unable to sign in. Please check your credentials.'));
      setLoading(false);
      return;
    }

    // Success — play the premium transition, then navigate.
    Keyboard.dismiss();
    setLoginSucceeded(true);
    await playSuccessAnimation();
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      {/* FIXED BACKGROUND — positioned independently of the scrollable
          auth content so it never contributes to scroll height. */}
      <Image
        source={require('../../assets/login-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <View style={styles.backgroundOverlay} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.screenContent}>
              {/* Logo intro & Header */}
              <View style={styles.header}>
                <Animated.Image
                  source={require('../../assets/auth-logo.png')}
                  style={[
                    styles.logo,
                    {
                      opacity: logoOpacity,
                      transform: [
                        { translateY: logoTravel },
                        { scale: Animated.multiply(logoPulse, logoSuccessScale) },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />

                <Animated.View style={{ opacity: Animated.multiply(titleOpacity, contentFade) }}>
                  <Text style={styles.title}>Welcome back</Text>
                </Animated.View>

                <Animated.View style={{ opacity: Animated.multiply(subtitleOpacity, contentFade) }}>
                  <Text style={styles.subtitle}>Sign in to continue to Regency Salma</Text>
                </Animated.View>
              </View>

              <Animated.View
                style={[
                  styles.formCard,
                  {
                    opacity: Animated.multiply(formOpacity, contentFade),
                    transform: [{ translateY: formTravel }],
                  },
                ]}
              >
                {Platform.OS === 'web' ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ display: 'contents' }}>
                    <FormContent email={email} setEmail={setEmail} password={password} setPassword={setPassword} errorMsg={errorMsg} setErrorMsg={setErrorMsg} touched={touched} setTouched={setTouched} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} handleLogin={handleLogin} loading={loading} router={router} />
                  </form>
                ) : (
                  <FormContent email={email} setEmail={setEmail} password={password} setPassword={setPassword} errorMsg={errorMsg} setErrorMsg={setErrorMsg} touched={touched} setTouched={setTouched} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} handleLogin={handleLogin} loading={loading} router={router} />
                )}
              </Animated.View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Login success confirmation overlay */}
      {loginSucceeded && (
        <Animated.View
          style={[styles.successOverlay, { pointerEvents: 'none' }]}
        >
          <Animated.View
            style={[styles.successBackdrop, { opacity: successOpacity }]}
          />

          <Animated.View
            style={[
              styles.successCircle,
              {
                opacity: successOpacity,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
              <Feather name="check" size={34} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>

          <Animated.View style={{ opacity: successOpacity }}>
            <Text style={styles.successTitle}>Welcome back!</Text>
            <Text style={styles.successSubtitle}>Signing you in securely</Text>
          </Animated.View>
        </Animated.View>
      )}

      {/* Screen preparation before navigation */}
      <Animated.View
        style={[styles.screenFade, { opacity: screenFade, pointerEvents: 'none' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * =====================================================
   * SCREEN + FIXED BACKGROUND
   * =====================================================
   *
   * The background image and overlay are absolutely positioned
   * over the root and clipped to the viewport. The scrollable
   * auth content lives above them and never carries the image.
   */

  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.75,
  },

  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(249, 247, 242, 0.7)',
  },

  safeArea: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },

  screenContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  /*
   * =====================================================
   * HEADER + LOGO
   * =====================================================
   */

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    marginBottom: 18,
  },

  title: {
    color: theme.colors.textPrimary,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.6,
    textAlign: 'center',
  },

  subtitle: {
    color: theme.colors.textSecondary,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },

  /*
   * =====================================================
   * FORM CARD
   * =====================================================
   */

  formCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 22,
    padding: 24,
    paddingTop: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    ...shadowBox('#143D2A', 0, 8, 0.08, 24, 2),
  },

  passwordField: {
    marginBottom: 8,
  },

  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  passwordLabel: {
    color: theme.colors.textPrimary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14.5,
  },

  forgotButton: {
    minHeight: 44,
    paddingVertical: 8,
    paddingLeft: 12,
    marginRight: -12,
    justifyContent: 'center',
  },

  forgotText: {
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },

  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.errorBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 18,
  },

  errorText: {
    flex: 1,
    color: theme.colors.error,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    lineHeight: 17,
  },

  /*
   * =====================================================
   * BUTTONS
   * =====================================================
   */

  loginButton: {
    marginTop: 2,
    marginBottom: 16,
    height: 62,
    borderRadius: theme.radii.pill,
  },

  /*
   * =====================================================
   * FOOTER
   * =====================================================
   */

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  footerText: {
    color: theme.colors.textSecondary,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    lineHeight: 19,
  },

  createAccountText: {
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    lineHeight: 19,
  },

  /*
   * =====================================================
   * PROGRESS
   * =====================================================
   */

  /*
   * =====================================================
   * LOGIN SUCCESS TRANSITION
   * =====================================================
   */

  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  successBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(249, 247, 242, 0.94)',
  },

  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 40,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadowBox(theme.colors.success, 0, 8, 0.28, 16, 6),
  },

  successTitle: {
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },

  successSubtitle: {
    color: theme.colors.textSecondary,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  screenFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
});
