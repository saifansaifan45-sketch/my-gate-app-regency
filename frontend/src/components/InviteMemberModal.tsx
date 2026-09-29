import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { PremiumPressable } from './ui/PremiumPressable';
import { AnimatedEntrance } from './ui/AnimatedEntrance';
import { theme } from '../theme';
import { useToast } from '../store/toast';
import { invitationsApi, InvitationRole } from '../api/invitations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLE_OPTIONS: { id: InvitationRole; label: string; icon: keyof typeof Feather.glyphMap; description: string; color: string; bg: string }[] = [
  { id: 'TENANT', label: 'Tenant', icon: 'key', description: 'Rents and lives in the unit', color: '#1D4ED8', bg: '#EFF6FF' },
  { id: 'CO_OWNER', label: 'Co-Owner', icon: 'users', description: 'Shares ownership of the unit', color: '#0369A1', bg: '#E0F2FE' },
  { id: 'FAMILY_MEMBER', label: 'Family Member', icon: 'heart', description: 'Lives with the owner', color: '#92400E', bg: '#FEF3C7' },
];

export function InviteMemberModal({
  visible,
  onClose,
  unitId,
  unitNumber,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  unitId?: string;
  unitNumber?: string;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<InvitationRole>('TENANT');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (visible) {
      setEmail('');
      setName('');
      setRole('TENANT');
      setMessage('');
      setSent(false);
      setSentEmail('');
      setEmailError('');
    }
  }, [visible]);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const canSubmit = email.trim().length > 0 && validateEmail(email) && !submitting;

  const handleInvite = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      await invitationsApi.create({
        email: email.toLowerCase().trim(),
        name: name.trim() || undefined,
        role,
        unitId,
        message: message.trim() || undefined,
      });

      setSentEmail(email.toLowerCase().trim());
      setSent(true);
      showToast({ title: 'Invitation sent', message: `Email sent to ${email}`, type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to send invitation';
      if (msg.includes('already registered')) {
        setEmailError('This email is already registered');
      } else if (msg.includes('already exists')) {
        setEmailError('An invitation already exists for this email');
      } else {
        showToast({ title: 'Invitation failed', message: msg, type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRole = ROLE_OPTIONS.find((r) => r.id === role) || ROLE_OPTIONS[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back button */}
            <AnimatedEntrance delay={30} distance={12}>
              <Pressable style={styles.backBtn} onPress={onClose}>
                <Feather name="arrow-left" size={20} color={theme.colors.textPrimary} />
              </Pressable>
            </AnimatedEntrance>

            {/* Step Badge */}
            <AnimatedEntrance delay={50} distance={12}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>INVITE MEMBER</Text>
              </View>
            </AnimatedEntrance>

            {/* Title */}
            <AnimatedEntrance delay={70} distance={14}>
              <View style={styles.header}>
                <Text style={styles.mainTitle}>
                  {sent ? 'Invitation Sent' : 'Invite to your home'}
                </Text>
                <Text style={styles.mainSub}>
                  {sent
                    ? `An email has been sent to ${sentEmail}`
                    : unitNumber
                    ? `Send an email invite to join Unit ${unitNumber}`
                    : 'Send an email invitation to join your unit'}
                </Text>
              </View>
            </AnimatedEntrance>

            {sent ? (
              /* ── Success State ── */
              <AnimatedEntrance delay={100} distance={16}>
                <View style={styles.formCard}>
                  <View style={styles.successIcon}>
                    <Feather name="check" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.successTitle}>Check their inbox</Text>
                  <Text style={styles.successDesc}>
                    We've sent an email to <Text style={{ fontWeight: '600' }}>{sentEmail}</Text> with a link to create their account and join as <Text style={{ fontWeight: '600' }}>{selectedRole.label}</Text>.
                  </Text>

                  <View style={styles.infoBanner}>
                    <Feather name="clock" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.infoBannerText}>The invitation link expires in 7 days</Text>
                  </View>

                  <Button
                    label="Done"
                    variant="outline"
                    onPress={() => {
                      if (onSuccess) onSuccess();
                      onClose();
                    }}
                    style={{ marginTop: 8 }}
                  />
                </View>
              </AnimatedEntrance>
            ) : (
              /* ── Form ── */
              <AnimatedEntrance delay={100} distance={16}>
                <View style={styles.formCard}>
                  {/* Email */}
                  <Text style={styles.fieldLabel}>Email address *</Text>
                  <View style={[styles.inputRow, emailError && styles.inputError]}>
                    <Feather name="mail" size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="tenant@email.com"
                      value={email}
                      onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                  {/* Name */}
                  <Text style={styles.fieldLabel}>Name (optional)</Text>
                  <View style={styles.inputRow}>
                    <Feather name="user" size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Rahul Verma"
                      value={name}
                      onChangeText={setName}
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>

                  {/* Role Selection */}
                  <Text style={styles.fieldLabel}>Relationship to unit *</Text>
                  <View style={styles.roleGrid}>
                    {ROLE_OPTIONS.map((option) => {
                      const isSelected = role === option.id;
                      return (
                        <PremiumPressable
                          key={option.id}
                          style={[styles.roleCard, isSelected && styles.roleCardActive]}
                          onPress={() => setRole(option.id)}
                          scaleTo={0.97}
                        >
                          <View style={[styles.roleIcon, { backgroundColor: option.bg }]}>
                            <Feather name={option.icon} size={18} color={option.color} />
                          </View>
                          <View style={styles.roleCopy}>
                            <Text style={[styles.roleLabel, isSelected && styles.roleLabelActive]}>{option.label}</Text>
                            <Text style={styles.roleDesc}>{option.description}</Text>
                          </View>
                          <View style={[styles.radio, isSelected && styles.radioActive]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                        </PremiumPressable>
                      );
                    })}
                  </View>

                  {/* Personal Message */}
                  <Text style={styles.fieldLabel}>Personal message (optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Add a note to the invitation email..."
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={theme.colors.textSecondary}
                  />

                  {/* Info Banner */}
                  <View style={styles.infoBanner}>
                    <Feather name="shield" size={16} color={theme.colors.primary} />
                    <Text style={styles.infoBannerText}>
                      They'll receive an email with a link to create their account. Their access will be pending your approval after signup.
                    </Text>
                  </View>

                  {/* Submit */}
                  <Button
                    label="Send Invitation"
                    icon="send"
                    onPress={handleInvite}
                    loading={submitting}
                    disabled={!canSubmit}
                    style={{ marginTop: 8 }}
                  />
                </View>
              </AnimatedEntrance>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  keyboardView: { flex: 1 },
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

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    letterSpacing: 1,
    color: theme.colors.primary,
  },

  header: { marginBottom: 24 },
  mainTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    lineHeight: 30,
  },
  mainSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },

  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputError: { borderColor: '#DC2626', borderWidth: 1.5 },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 46,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  textArea: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    textAlignVertical: 'top',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#DC2626', marginTop: -8, marginBottom: 8, marginLeft: 2 },

  roleGrid: { gap: 8, marginBottom: 16 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  roleCardActive: { borderColor: theme.colors.primary, backgroundColor: '#F0FAF3' },
  roleIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roleCopy: { flex: 1 },
  roleLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: theme.colors.textPrimary },
  roleLabelActive: { color: theme.colors.primary },
  roleDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: theme.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F8F5',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.08)',
  },
  infoBannerText: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: '#506057' },

  /* Success State */
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  successTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  successDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },
});
