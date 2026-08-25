import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { TextInput as RNTextInput } from 'react-native';
import { PremiumPressable } from './ui/PremiumPressable';
import { Button } from './ui/Button';
import { BottomSheet } from './ui/BottomSheet';
import { theme } from '../theme';
import { api } from '../api/client';
import { useToast } from '../store/toast';
import { useQuery } from '@tanstack/react-query';

const COMMON_PROVIDERS = ['Uber', 'Rapido', 'Ola', 'Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Porter', 'Custom'];

export function UnannouncedArrivalModal({
  visible,
  onClose,
  onSuccess
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  
  const [visitorType, setVisitorType] = useState('GUEST');
  const [providerPreset, setProviderPreset] = useState('');
  const [customProvider, setCustomProvider] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  
  const [activeUnit, setActiveUnit] = useState('');
  const { data: units = [] } = useQuery({
    queryKey: ['communityUnits'],
    queryFn: async () => {
      const res = await api.get('/community/units');
      return res.data.units || [];
    }
  });
  
  const [submitting, setSubmitting] = useState(false);

  const isExternal = visitorType === 'CAB' || visitorType === 'DELIVERY';
  const activeProvider = providerPreset === 'Custom' ? customProvider : providerPreset;

  const resetForm = () => {
    setVisitorType('GUEST');
    setProviderPreset('');
    setCustomProvider('');
    setName('');
    setPhone('');
    setVehicleNumber('');
    setActiveUnit('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible]);
  
  const matchedUnit = units.find((u: any) => u.unitNumber.toUpperCase() === activeUnit.toUpperCase());
  const unitSuggestions = activeUnit.trim()
    ? units
        .filter((u: any) => u.unitNumber.toUpperCase().includes(activeUnit.toUpperCase()))
        .slice(0, 6)
    : [];

  const canSubmit = () => {
    if (!matchedUnit) return false;
    if (isExternal && !activeProvider.trim()) return false;
    if (!isExternal && !name.trim()) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    
    try {
      const response = await api.post<{ deduped?: boolean }>('/visitors/unannounced', {
        name: isExternal ? name || activeProvider : name,
        phone: phone || undefined,
        vehicleNumber: vehicleNumber || undefined,
        visitorType,
        provider: isExternal ? activeProvider : undefined,
        unitId: matchedUnit.id
      });
      
      showToast({
        title: response.data.deduped ? 'Existing alert found' : 'Alert sent',
        message: response.data.deduped ? 'This arrival was already sent to the resident recently.' : 'Resident has been notified for approval.',
        type: 'success',
      });
      if (onSuccess) onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.response?.data?.error?.message || 'Failed to alert resident', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Unannounced Arrival</Text>
            <PremiumPressable style={styles.closeBtn} onPress={handleClose}>
              <Feather name="x" size={20} color={theme.colors.textSecondary} />
            </PremiumPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

            <Text style={styles.fieldLabel}>Target Unit *</Text>
            <RNTextInput
              style={styles.input}
              placeholder="Lookup Unit (e.g. 7B, 9A)"
              value={activeUnit}
              onChangeText={setActiveUnit}
              autoCapitalize="characters"
              placeholderTextColor={theme.colors.textSecondary}
            />
            {matchedUnit ? (
              <View style={styles.selectedUnit}>
                <Feather name="check-circle" size={15} color={theme.colors.success} />
                <Text style={styles.selectedUnitText}>Unit {matchedUnit.unitNumber} selected</Text>
              </View>
            ) : activeUnit && unitSuggestions.length > 0 ? (
              <View style={styles.unitSuggestions}>
                {unitSuggestions.map((unit: any) => (
                  <PremiumPressable
                    key={unit.id}
                    style={styles.unitSuggestion}
                    onPress={() => setActiveUnit(unit.unitNumber)}
                  >
                    <Feather name="home" size={15} color={theme.colors.primary} />
                    <Text style={styles.unitSuggestionText}>Unit {unit.unitNumber}</Text>
                    <Feather name="arrow-up-left" size={14} color={theme.colors.textSecondary} />
                  </PremiumPressable>
                ))}
              </View>
            ) : activeUnit ? (
              <Text style={styles.errorText}>Unit not found.</Text>
            ) : null}

            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Type of Arrival</Text>
            <View style={styles.typeRow}>
              {['GUEST', 'CAB', 'DELIVERY', 'SERVICE'].map((type) => (
                <PremiumPressable
                  key={type}
                  style={[styles.typePill, visitorType === type && styles.typePillSelected]}
                  onPress={() => setVisitorType(type)}
                >
                  <Text style={[styles.typePillText, visitorType === type && styles.typePillTextSelected]}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Text>
                </PremiumPressable>
              ))}
            </View>

            {isExternal && (
              <>
                <Text style={styles.fieldLabel}>Provider *</Text>
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
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Optional Details</Text>

            {!isExternal && (
              <RNTextInput
                style={styles.input}
                placeholder="Visitor name *"
                value={name}
                onChangeText={setName}
                placeholderTextColor={theme.colors.textSecondary}
              />
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
              placeholder="Phone number (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textSecondary}
            />

            <RNTextInput
              style={styles.input}
              placeholder="Vehicle number (optional)"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              autoCapitalize="characters"
              placeholderTextColor={theme.colors.textSecondary}
            />

            <Button
              label="Request Resident Approval"
              icon="bell"
              onPress={handleCreate}
              loading={submitting}
              disabled={!canSubmit() || submitting}
              style={styles.actionBtn}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { width: '100%', maxHeight: '90%' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, maxHeight: '100%', shadowColor: '#081C11', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 16 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, letterSpacing: -0.4, color: theme.colors.textPrimary },
  closeBtn: { width: 44, height: 44, borderRadius: 20, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  fieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary, marginBottom: 8 },
  errorText: { color: theme.colors.error, fontSize: 12, marginBottom: 12, marginTop: -8 },
  unitSuggestions: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface, marginBottom: 12, overflow: 'hidden' },
  unitSuggestion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  unitSuggestionText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textPrimary },
  selectedUnit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 12, paddingHorizontal: 2 },
  selectedUnitText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.success },
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
  actionBtn: { width: '100%', marginTop: 12, marginBottom: 10 },
});
