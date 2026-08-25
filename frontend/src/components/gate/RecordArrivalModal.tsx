import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Platform, KeyboardAvoidingView, useWindowDimensions, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { theme } from '../../theme';
import { visitorsApi } from '../../api/visitors';
import { useToast } from '../../store/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VISITOR_TYPES: Array<{ type: 'GUEST' | 'CAB' | 'DELIVERY' | 'SERVICE'; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { type: 'GUEST' as const, label: 'Guest', icon: 'user' },
  { type: 'CAB' as const, label: 'Cab', icon: 'truck' },
  { type: 'DELIVERY' as const, label: 'Delivery', icon: 'package' },
  { type: 'SERVICE' as const, label: 'Service', icon: 'briefcase' },
];

const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
];

export function RecordArrivalModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const dialogHeight = Math.min(680, screenHeight - insets.top - insets.bottom - 32);

  const [visitorType, setVisitorType] = useState<'GUEST' | 'CAB' | 'DELIVERY' | 'SERVICE'>('GUEST');
  const [unitId, setUnitId] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitSuggestions, setUnitSuggestions] = useState<Array<{ id: string; unitNumber: string }>>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  // External service specific
  const [provider, setProvider] = useState('');
  const [duration, setDuration] = useState(15);

  // Primary details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const isExternal = visitorType === 'CAB' || visitorType === 'DELIVERY';
  const requiresOtp = visitorType === 'GUEST';

  const canSubmit = () => {
    if (!unitId) return false;
    if (isExternal && !provider.trim()) return false;
    if (!isExternal && !name.trim()) return false;
    if (visitorType === 'SERVICE' && !purpose.trim()) return false;
    return true;
  };

  // Debounced unit search
  useEffect(() => {
    if (unitSearch.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          // In a real app, you'd have a dedicated unit search endpoint
          // For now, we'll just validate the format
          setUnitSuggestions([]);
        } catch {
          setUnitSuggestions([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    setUnitSuggestions([]);
  }, [unitSearch]);

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);

    try {
      const now = new Date();
      const validUntil = new Date(now.getTime() + duration * 60000);

      const payload = {
        name: isExternal ? name || provider : name,
        phone: phone || undefined,
        purpose: purpose || undefined,
        vehicleNumber: vehicleNumber || undefined,
        visitorType,
        provider: isExternal ? provider : undefined,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
        unitId,
      };

      await visitorsApi.createVisitor(payload);
      showToast({ title: 'Success', message: 'Unannounced arrival recorded. Resident notified.', type: 'success' });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.response?.data?.error?.message || 'Failed to record arrival', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setVisitorType('GUEST');
      setUnitId('');
      setUnitSearch('');
      setProvider('');
      setDuration(15);
      setName('');
      setPhone('');
      setPurpose('');
      setVehicleNumber('');
    }
  }, [visible]);

  return (
    <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.keyboardView, { height: dialogHeight }]}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Record a new arrival</Text>
            <PremiumPressable style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={theme.colors.textSecondary} />
            </PremiumPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {/* Visitor Type */}
            <Text style={styles.fieldLabel}>Type of Arrival</Text>
            <View style={styles.typeRow}>
              {VISITOR_TYPES.map((t) => (
                <PremiumPressable
                  key={t.type}
                  style={[styles.typePill, visitorType === t.type && styles.typePillSelected]}
                  onPress={() => { setVisitorType(t.type); setUnitId(''); setUnitSearch(''); }}
                >
                  <Feather name={t.icon} size={16} color={visitorType === t.type ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[styles.typePillText, visitorType === t.type && styles.typePillTextSelected]}>{t.label}</Text>
                </PremiumPressable>
              ))}
            </View>

            {/* Unit Selection */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Unit <Text style={styles.required}>*</Text></Text>
            <View style={styles.unitSearchWrapper}>
              <Feather name="home" size={16} color={theme.colors.textSecondary} style={styles.unitIcon} />
              <TextInput
                style={styles.unitInput}
                placeholder="Select or type unit number (e.g. 7B)"
                placeholderTextColor={theme.colors.textSecondary}
                value={unitSearch}
                onChangeText={(v) => { setUnitSearch(v.toUpperCase()); setShowUnitDropdown(true); }}
                onFocus={() => setShowUnitDropdown(true)}
                onBlur={() => setTimeout(() => setShowUnitDropdown(false), 200)}
                autoCapitalize="characters"
              />
              {unitId && (
                <PremiumPressable onPress={() => { setUnitId(''); setUnitSearch(''); }} hitSlop={8}>
                  <Feather name="x" size={14} color={theme.colors.textSecondary} />
                </PremiumPressable>
              )}
            </View>

            {showUnitDropdown && unitSuggestions.length > 0 && (
              <View style={styles.unitDropdown}>
                {unitSuggestions.map((u) => (
                  <PremiumPressable key={u.id} style={styles.unitOption} onPress={() => { setUnitId(u.id); setUnitSearch(u.unitNumber); setShowUnitDropdown(false); }}>
                    <Text style={styles.unitOptionText}>{u.unitNumber}</Text>
                  </PremiumPressable>
                ))}
              </View>
            )}

            {/* External Service Fields */}
            {isExternal && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Provider <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter provider name (e.g. Amazon, Uber)"
                  value={provider}
                  onChangeText={setProvider}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="words"
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Access Window *</Text>
                <View style={styles.chipsRow}>
                  {DURATIONS.map((d) => (
                    <PremiumPressable
                      key={d.minutes}
                      style={[styles.chip, duration === d.minutes && styles.chipSelected]}
                      onPress={() => setDuration(d.minutes)}
                    >
                      <Text style={[styles.chipText, duration === d.minutes && styles.chipTextSelected]}>{d.label}</Text>
                    </PremiumPressable>
                  ))}
                </View>
              </>
            )}

            {/* Guest/Service Fields */}
            {!isExternal && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Visitor name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter visitor name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Purpose</Text>
            <TextInput
              style={styles.input}
              placeholder={visitorType === 'SERVICE' ? 'Enter purpose *' : 'Enter purpose'}
              value={purpose}
              onChangeText={setPurpose}
              placeholderTextColor={theme.colors.textSecondary}
            />

            <TextInput
              style={styles.input}
              placeholder="Vehicle number (optional)"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              autoCapitalize="characters"
              placeholderTextColor={theme.colors.textSecondary}
            />

            <TextInput
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
            label={requiresOtp ? 'Record arrival & notify resident' : 'Pre-approve & notify resident'}
            icon="shield"
            onPress={handleCreate}
            loading={submitting}
            disabled={!canSubmit() || submitting}
            style={styles.actionBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
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
  required: { color: '#DC2626' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 98 },
  typePillSelected: { backgroundColor: theme.colors.primary },
  typePillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textPrimary },
  typePillTextSelected: { color: '#FFFFFF' },
  unitSearchWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  unitIcon: { marginRight: 4 },
  unitInput: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary },
  unitDropdown: { marginTop: 4, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, overflow: 'hidden' },
  unitOption: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  unitOptionText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary },
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
  actionBtn: { width: '100%', marginTop: 4 },
});
