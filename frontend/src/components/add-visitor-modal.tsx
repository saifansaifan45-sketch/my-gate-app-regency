import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Text } from './ui/Text';
import { TextInput as RNTextInput } from 'react-native';
import { Pressable } from 'react-native';
import { PremiumPressable } from './ui/PremiumPressable';
import { Button } from './ui/Button';
import { theme } from '../theme';
import { visitorsApi, VisitorType, CreateVisitorPayload } from '../api/visitors';
import { useToast } from '../store/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COMMON_PROVIDERS = [
  'Uber', 'Rapido', 'Ola', 'Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Porter', 'Blinkit', 'Zepto', 'Dunzo', 'Custom'
];

const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
  { label: '1 day', minutes: 1440 },
];

export function AddVisitorModal({
  visible,
  onClose,
  initialType = 'GUEST',
  initialVisitorType,
  initialPurpose,
  title,
  onSuccess,
  managerMode = false,
}: {
  visible: boolean;
  onClose: () => void;
  initialType?: VisitorType;
  initialVisitorType?: VisitorType;
  initialPurpose?: string;
  title?: string;
  onSuccess?: () => void;
  /** Uses the manager-scoped invite endpoint and attaches the manager as host. */
  managerMode?: boolean;
}) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const dialogHeight = Math.min(640, screenHeight - insets.top - insets.bottom - 32);
  
  const [visitorType, setVisitorType] = useState<VisitorType>(initialType);
  
  // External service specific
  const [providerPreset, setProviderPreset] = useState<string>('');
  const [customProvider, setCustomProvider] = useState('');
  
  const [durationPreset, setDurationPreset] = useState<number>(15);
  
  // Primary details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [orderReference, setOrderReference] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [generatedPass, setGeneratedPass] = useState<any>(null);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [vehicleError, setVehicleError] = useState<string>('');

  // Validation functions
  const validatePhone = (value: string): string => {
    if (!value.trim()) return '';
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const indianMobileRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(value.replace(/\s|-/g, '')) && !indianMobileRegex.test(value.replace(/\s|-/g, ''))) {
      return 'Enter a valid phone number (e.g. +91 9876543210 or 9876543210)';
    }
    return '';
  };

  const validateVehicle = (value: string): string => {
    if (!value.trim()) return '';
    // Indian vehicle format: XX##XX#### (e.g., MH12AB1234)
    const vehicleRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/i;
    if (!vehicleRegex.test(value.toUpperCase().replace(/\s/g, ''))) {
      return 'Enter valid vehicle number (e.g. MH12AB1234)';
    }
    return '';
  };

  useEffect(() => {
    if (visible) {
      setVisitorType(initialVisitorType || initialType);
      setPurpose(initialPurpose || '');
      setProviderPreset('');
      setCustomProvider('');
      setDurationPreset(15);
      setName('');
      setPhone('');
      setVehicleNumber('');
      setOrderReference('');
      setGeneratedPass(null);
    }
  }, [visible, initialType, initialVisitorType, initialPurpose]);

  const isExternal = visitorType === 'CAB' || visitorType === 'DELIVERY';
  const requiresOtp = visitorType === 'GUEST';
  
  const activeProvider = providerPreset === 'Custom' ? customProvider : providerPreset;
  
  const canSubmit = () => {
    if (isExternal && !activeProvider.trim()) return false;
    if (!isExternal && !name.trim()) return false;
    if (!purpose.trim()) return false;
    if (phoneError || vehicleError) return false;
    if (customDuration && (parseInt(customDuration) < 5 || parseInt(customDuration) > 10080)) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    
    try {
      const now = new Date();
      // Use custom duration if provided, otherwise use preset
      const durationMinutes = customDuration ? parseInt(customDuration) : durationPreset;
      const validUntil = new Date(now.getTime() + durationMinutes * 60000);
      
      const payload: CreateVisitorPayload = {
        name: isExternal ? name || activeProvider : name,
        phone: phone || undefined,
        purpose: purpose || undefined,
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().replace(/\s/g, '') : undefined,
        visitorType,
        provider: isExternal ? activeProvider : undefined,
        orderReference: orderReference || undefined,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString()
      };
      
      const res = managerMode
        ? await visitorsApi.createManagerInvite(payload)
        : await visitorsApi.createVisitor(payload);
      
      if (res.visitor.otp) {
        setGeneratedPass(res.visitor);
      } else {
        const isGuest = visitorType === 'GUEST';
        showToast({ 
          title: 'Success', 
          message: isGuest ? 'Guest pass generated with OTP' : `${visitorType} pre-approved. No OTP required.`, 
          type: 'success' 
        });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err.response?.data?.error?.message || 'Failed to create pass', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyOtp = async () => {
    if (generatedPass?.otp) {
      await Clipboard.setStringAsync(generatedPass.otp);
      showToast({ title: 'Copied', message: 'Pass code copied to clipboard', type: 'success' });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.keyboardView, { maxHeight: dialogHeight }]}
        >
          <View style={[styles.sheet, { maxHeight: dialogHeight }]}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{generatedPass ? 'Entry Pass Ready' : title || 'Approve Entries'}</Text>
                <Text style={styles.sheetSubtitle}>
                  {managerMode ? 'Authorized facility & township pass' : 'Pre-approved guest or service access'}
                </Text>
              </View>
              <PremiumPressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={theme.colors.textSecondary} />
              </PremiumPressable>
            </View>

            {generatedPass ? (
              <View style={styles.successContent}>
                <View style={styles.successIcon}>
                  <Feather name="check" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.passTitle}>{generatedPass.name}</Text>
                <Text style={styles.passDetail}>
                  {generatedPass.provider ? `${generatedPass.provider} • ` : ''}
                  Valid today until {new Date(generatedPass.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>

                <View style={styles.otpBox}>
                  <Text style={styles.otpLabel}>ENTRY CODE</Text>
                  <Text style={styles.otpCode}>{generatedPass.otp}</Text>
                </View>

                <Text style={styles.otpWarning}>
                  Share this 6-digit code with your visitor. The watchman will verify it at the gate.
                </Text>

                <Button
                  label="Copy Entry Code"
                  icon="copy"
                  variant="primary"
                  onPress={copyOtp}
                  style={styles.actionBtn}
                />
                <Button
                  label="Done"
                  variant="outline"
                  onPress={() => {
                    if (onSuccess) onSuccess();
                    onClose();
                  }}
                  style={styles.actionBtn}
                />
              </View>
            ) : (
              <View style={styles.formBody}>
                <ScrollView
                  style={[styles.formScroll, { maxHeight: dialogHeight - 165 }]}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.fieldLabel}>Visitor Type</Text>
                  <View style={styles.typeRow}>
                    {(['GUEST', 'CAB', 'DELIVERY', 'SERVICE'] as const).map((type) => (
                      <PremiumPressable
                        key={type}
                        style={[styles.typePill, visitorType === type && styles.typePillSelected]}
                        onPress={() => setVisitorType(type as VisitorType)}
                        scaleTo={0.96}
                      >
                        <Text style={[styles.typePillText, visitorType === type && styles.typePillTextSelected]}>
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </Text>
                      </PremiumPressable>
                    ))}
                  </View>

                  {isExternal && (
                    <>
                      <Text style={styles.fieldLabel}>Provider <Text style={styles.required}>*</Text></Text>
                      <View style={styles.chipsRow}>
                        {COMMON_PROVIDERS.map((p) => (
                          <PremiumPressable
                            key={p}
                            style={[styles.chip, providerPreset === p && styles.chipSelected]}
                            onPress={() => setProviderPreset(p)}
                            scaleTo={0.96}
                          >
                            <Text style={[styles.chipText, providerPreset === p && styles.chipTextSelected]}>{p}</Text>
                          </PremiumPressable>
                        ))}
                      </View>
                      {providerPreset === 'Custom' && (
                        <RNTextInput
                          style={[styles.input, { marginTop: 8 }]}
                          placeholder="Enter provider name *"
                          value={customProvider}
                          onChangeText={setCustomProvider}
                          placeholderTextColor={theme.colors.textSecondary}
                        />
                      )}

                      <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Access Window <Text style={styles.required}>*</Text></Text>
                      <View style={styles.chipsRow}>
                        {DURATIONS.map((d) => (
                          <PremiumPressable
                            key={d.minutes}
                            style={[styles.chip, durationPreset === d.minutes && styles.chipSelected]}
                            onPress={() => { setDurationPreset(d.minutes); setCustomDuration(''); }}
                            scaleTo={0.96}
                          >
                            <Text style={[styles.chipText, durationPreset === d.minutes && styles.chipTextSelected]}>{d.label}</Text>
                          </PremiumPressable>
                        ))}
                      </View>
                      <RNTextInput
                        style={[styles.input, { marginTop: 8 }]}
                        placeholder="Custom duration (minutes, 5-10080)"
                        value={customDuration}
                        onChangeText={(v) => { setCustomDuration(v.replace(/\D/g, '')); setDurationPreset(0); }}
                        placeholderTextColor={theme.colors.textSecondary}
                        keyboardType="number-pad"
                      />
                    </>
                  )}

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Details</Text>
                  
                  {!isExternal && (
                    <>
                      <Text style={styles.fieldLabel}>Visitor name <Text style={styles.required}>*</Text></Text>
                      <RNTextInput
                        style={styles.input}
                        placeholder="Enter visitor name"
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </>
                  )}
                  {isExternal && (
                    <RNTextInput
                      style={styles.input}
                      placeholder="Driver/Agent name (optional)"
                      value={name}
                      onChangeText={setName}
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  )}
                  
                  <Text style={styles.fieldLabel}>Purpose of visit <Text style={styles.required}>*</Text></Text>
                  <RNTextInput
                    style={styles.input}
                    placeholder="e.g. Plumber, Meeting, Delivery"
                    value={purpose}
                    onChangeText={setPurpose}
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  
                  <RNTextInput
                    style={[styles.input, vehicleError && styles.inputError]}
                    placeholder="Vehicle number (optional)"
                    value={vehicleNumber}
                    onChangeText={(v) => { setVehicleNumber(v.toUpperCase()); setVehicleError(validateVehicle(v)); }}
                    autoCapitalize="characters"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  {Boolean(vehicleError) && <Text style={styles.errorText}>{vehicleError}</Text>}
                  
                  <RNTextInput
                    style={[styles.input, phoneError && styles.inputError]}
                    placeholder="Mobile number (optional)"
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setPhoneError(validatePhone(v)); }}
                    keyboardType="phone-pad"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  {Boolean(phoneError) && <Text style={styles.errorText}>{phoneError}</Text>}

                  <View style={styles.infoCard}>
                    <View style={styles.infoIcon}>
                      <Feather name={requiresOtp ? 'shield' : 'check-circle'} size={20} color={requiresOtp ? theme.colors.primary : '#10B981'} />
                    </View>
                    <View style={styles.infoText}>
                      <Text style={styles.infoTitle}>
                        {requiresOtp ? 'OTP will be generated for guest' : 'No OTP needed - gate confirms on arrival'}
                      </Text>
                      <Text style={styles.infoDesc}>
                        {requiresOtp
                          ? 'Share the OTP with your guest. The watchman will verify it at the gate.'
                          : 'The watchman will confirm their approved arrival and record entry. No OTP required.'}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.formFooter}>
                  <Button
                    label={managerMode
                      ? (requiresOtp ? 'Create guest invite' : 'Create visitor invite')
                      : (requiresOtp ? 'Generate guest pass' : 'Pre-approve entry')}
                    icon="shield"
                    onPress={handleCreate}
                    loading={submitting}
                    disabled={!canSubmit() || submitting}
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  keyboardView: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
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
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17.5,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  typePillSelected: {
    backgroundColor: theme.colors.primary,
  },
  typePillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  typePillTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#EAF4EC',
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#4B5563',
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  inputError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#DC2626',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F8F5',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.08)',
    marginTop: 4,
    marginBottom: 10,
    gap: 10,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: theme.colors.primary,
    marginBottom: 1,
  },
  infoDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11.5,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  successContent: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  successIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  passTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    color: theme.colors.textPrimary,
    marginBottom: 3,
    textAlign: 'center',
  },
  passDetail: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    textAlign: 'center',
  },
  otpBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  otpLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.textSecondary,
    marginBottom: 3,
  },
  otpCode: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    letterSpacing: 6,
    color: theme.colors.primary,
  },
  otpWarning: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  actionBtn: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  formBody: {
    flexShrink: 1,
  },
  formScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  formFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  required: {
    color: '#DC2626',
  },
});
