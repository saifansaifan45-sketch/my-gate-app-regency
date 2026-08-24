import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, ScrollView, Switch, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Text } from './ui/Text';
import { TextInput as RNTextInput } from 'react-native';
import { Pressable } from 'react-native';
import { PremiumPressable } from './ui/PremiumPressable';
import { Button } from './ui/Button';
import { theme } from '../theme';
import { useSession } from '../store/auth';
import { visitorsApi, VisitorType, CreateVisitorPayload } from '../api/visitors';
import { useToast } from '../store/toast';

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
  const { user } = useSession();
  const { showToast } = useToast();
  const { height: screenHeight } = useWindowDimensions();
  
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
  }, [visible, initialType]);

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: screenHeight * 0.9 }}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{generatedPass ? 'Entry Pass Ready' : 'Approve Entries'}</Text>
              <PremiumPressable style={styles.closeBtn} onPress={onClose}>
                <Feather name="x" size={20} color={theme.colors.textSecondary} />
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
              <View style={{ flex: 1 }}>
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
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, letterSpacing: -0.4, color: theme.colors.textPrimary },
  closeBtn: { width: 44, height: 44, borderRadius: 20, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  fieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 98 },
  typePillSelected: { backgroundColor: theme.colors.primary },
  typePillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: theme.colors.textPrimary },
  typePillTextSelected: { color: '#FFFFFF' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipSelected: { backgroundColor: '#F3F8F5', borderColor: theme.colors.primary },
  chipText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#4B5563' },
  chipTextSelected: { color: theme.colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary, backgroundColor: '#FFFFFF', marginBottom: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F3F8F5', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(20,61,42,0.08)', marginTop: 8, marginBottom: 20, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  infoText: { flex: 1 },
  infoTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: theme.colors.primary, marginBottom: 2 },
  infoDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },
  successContent: { alignItems: 'center', paddingVertical: 12 },
  successIcon: { width: 56, height: 56, borderRadius: 26, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  passTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: theme.colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  passDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  otpBox: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  otpLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1, color: theme.colors.textSecondary, marginBottom: 6 },
  otpCode: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 34, letterSpacing: 6, color: theme.colors.primary },
  otpWarning: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24, paddingHorizontal: 12 },
  actionBtn: { width: '100%', marginBottom: 10 },
  required: { color: '#DC2626' },
});
