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
  'Uber', 'Rapido', 'Ola', 'Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Porter', 'Custom'
];

const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '20 min', minutes: 20 },
  { label: '1 hour', minutes: 60 },
  { label: '1 day', minutes: 1440 },
];

export function AddVisitorModal({
  visible,
  onClose,
  initialType = 'GUEST',
  initialVisitorType,
  initialPurpose,
  title,
  onSuccess
}: {
  visible: boolean;
  onClose: () => void;
  initialType?: VisitorType;
  initialVisitorType?: VisitorType;
  initialPurpose?: string;
  title?: string;
  onSuccess?: () => void;
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

  useEffect(() => {
    if (visible) {
      setVisitorType(initialVisitorType || initialType);
      setPurpose(initialPurpose || '');
      setProviderPreset('');
      setCustomProvider('');
      setDurationPreset(15);
      setName('');
      setPhone('');
      setPurpose('');
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
    if (visitorType === 'SERVICE' && !purpose.trim()) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    
    try {
      const now = new Date();
      const validUntil = new Date(now.getTime() + durationPreset * 60000);
      
      const payload: CreateVisitorPayload = {
        name: isExternal ? name || activeProvider : name,
        phone: phone || undefined,
        purpose: purpose || undefined,
        vehicleNumber: vehicleNumber || undefined,
        visitorType,
        provider: isExternal ? activeProvider : undefined,
        orderReference: orderReference || undefined,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString()
      };
      
      const res = await visitorsApi.createVisitor(payload);
      
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
            paddingBottom: Math.max(insets.bottom + 16, 32),
          },
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.keyboardView, { height: dialogHeight }]}
      >
        <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{generatedPass ? 'Entry Pass Ready' : title || 'Approve Entries'}</Text>
              <PremiumPressable style={styles.closeBtn} onPress={onClose}>
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
                  Share this code with your visitor. The gate watchman will verify it upon arrival.
                </Text>

                <Button label="Copy Code" icon="copy" variant="outline" onPress={copyOtp} style={styles.actionBtn} />
                <Button label="Done" onPress={onClose} style={styles.actionBtn} />
              </View>
            ) : (
              <View style={styles.formBody}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                <Text style={styles.fieldLabel}>Type of Arrival</Text>
                <View style={styles.typeRow}>
                  {['GUEST', 'CAB', 'DELIVERY', 'SERVICE'].map((type) => (
                    <PremiumPressable
                      key={type}
                      style={[styles.typePill, visitorType === type && styles.typePillSelected]}
                      onPress={() => setVisitorType(type as VisitorType)}
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

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Access Window *</Text>
                    <View style={styles.chipsRow}>
                      {DURATIONS.map((d) => (
                        <PremiumPressable
                          key={d.minutes}
                          style={[styles.chip, durationPreset === d.minutes && styles.chipSelected]}
                          onPress={() => setDurationPreset(d.minutes)}
                        >
                          <Text style={[styles.chipText, durationPreset === d.minutes && styles.chipTextSelected]}>{d.label}</Text>
                        </PremiumPressable>
                      ))}
                    </View>
                  </>
                )}

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Details</Text>
                
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
                
                <RNTextInput
                  style={styles.input}
                  placeholder="Vehicle number (optional)"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.textSecondary}
                />
                
                <RNTextInput
                  style={styles.input}
                  placeholder="Mobile number (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.textSecondary}
                />

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

              <Button
                label={requiresOtp ? 'Generate guest pass' : 'Pre-approve entry'}
                icon="shield"
                onPress={handleCreate}
                loading={submitting}
                disabled={!canSubmit() || submitting}
                style={styles.actionBtn}
              />
              </View>
            )}
        </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  keyboardView: { width: '100%', maxWidth: 520 },
  sheet: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 22, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, shadowColor: '#143D2A', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.2, shadowRadius: 28, elevation: 12 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, letterSpacing: -0.3, color: theme.colors.textPrimary },
  closeBtn: { width: 38, height: 38, borderRadius: 18, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  fieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: theme.colors.textPrimary, marginBottom: 6 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 98 },
  typePillSelected: { backgroundColor: theme.colors.primary },
  typePillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textPrimary },
  typePillTextSelected: { color: '#FFFFFF' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  chip: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipSelected: { backgroundColor: '#F3F8F5', borderColor: theme.colors.primary },
  chipText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: '#4B5563' },
  chipTextSelected: { color: theme.colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  input: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13.5, color: theme.colors.textPrimary, backgroundColor: '#FFFFFF', marginBottom: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F3F8F5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(20,61,42,0.08)', marginTop: 6, marginBottom: 16, gap: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  infoText: { flex: 1 },
  infoTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.primary, marginBottom: 1 },
  infoDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, lineHeight: 15, color: theme.colors.textSecondary },
  successContent: { alignItems: 'center', paddingVertical: 10 },
  successIcon: { width: 50, height: 50, borderRadius: 24, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  passTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary, marginBottom: 3, textAlign: 'center' },
  passDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: theme.colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  otpBox: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  otpLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 1, color: theme.colors.textSecondary, marginBottom: 4 },
  otpCode: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 30, letterSpacing: 5, color: theme.colors.primary },
  otpWarning: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  actionBtn: { width: '100%', marginBottom: 8 },
  formBody: { flex: 1 },
  required: { color: '#DC2626' },
});
