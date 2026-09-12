import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Platform, KeyboardAvoidingView, useWindowDimensions, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { theme } from '../../theme';
import { visitorsApi, GateHost, GateUnit } from '../../api/visitors';
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
  const dialogHeight = Math.min(680, screenHeight - insets.top - insets.bottom - 48);

  const [visitorType, setVisitorType] = useState<'GUEST' | 'CAB' | 'DELIVERY' | 'SERVICE'>('GUEST');
  const [targetType, setTargetType] = useState<'RESIDENCE' | 'MANAGER'>('RESIDENCE');
  const [unitId, setUnitId] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [units, setUnits] = useState<GateUnit[]>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [hostUserId, setHostUserId] = useState('');
  const [hostSearch, setHostSearch] = useState('');
  const [hosts, setHosts] = useState<GateHost[]>([]);
  const [showHostDropdown, setShowHostDropdown] = useState(false);

  // External service specific
  const [provider, setProvider] = useState('');
  const [duration, setDuration] = useState(15);

  // Primary details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isExternal = visitorType === 'CAB' || visitorType === 'DELIVERY';
  const requiresOtp = visitorType === 'GUEST';

  const canSubmit = () => {
    if (targetType === 'RESIDENCE' && !unitId) return false;
    if (targetType === 'MANAGER' && !hostUserId) return false;
    if (isExternal && !provider.trim()) return false;
    if (!isExternal && !name.trim()) return false;
    if (visitorType === 'SERVICE' && !purpose.trim()) return false;
    return true;
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.all([visitorsApi.getGateUnits(), visitorsApi.getGateHosts()])
      .then(([unitResponse, hostResponse]) => {
        if (!cancelled) {
          setUnits(unitResponse.units || []);
          setHosts(hostResponse.hosts || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnits([]);
          setHosts([]);
        }
      });
    return () => { cancelled = true; };
  }, [visible]);

  const unitSuggestions = unitSearch.trim()
    ? units.filter((unit) => unit.unitNumber.toUpperCase().includes(unitSearch.toUpperCase())).slice(0, 6)
    : [];
  const hostSuggestions = hostSearch.trim()
    ? hosts.filter((host) => `${host.firstName || ''} ${host.lastName || ''}`.toUpperCase().includes(hostSearch.toUpperCase())).slice(0, 6)
    : hosts.slice(0, 6);

  const hostLabel = (host: GateHost) => `${host.firstName || ''} ${host.lastName || ''}`.trim() || 'Manager';

  const clearTarget = () => {
    setUnitId('');
    setUnitSearch('');
    setHostUserId('');
    setHostSearch('');
  };

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
        ...(targetType === 'RESIDENCE' ? { unitId } : { hostUserId }),
      };

      const response = await visitorsApi.recordUnannouncedArrival(payload);
      showToast({
        title: response.deduped ? 'Existing alert found' : 'Alert sent',
        message: response.deduped
          ? 'This arrival was already sent recently.'
          : targetType === 'MANAGER' ? 'The manager has been notified.' : 'The residence has been notified.',
        type: 'success',
      });
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
      setTargetType('RESIDENCE');
      setUnitId('');
      setUnitSearch('');
      setHostUserId('');
      setHostSearch('');
      setProvider('');
      setDuration(15);
      setName('');
      setPhone('');
      setPurpose('');
      setVehicleNumber('');
      setFocusedField(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top + 16, 24), paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.keyboardView, { maxHeight: dialogHeight }]}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Record New Arrival</Text>
                <Text style={styles.sheetSubtitle}>Generate instant pass and notify host</Text>
              </View>
              <PremiumPressable
                style={styles.closeBtn}
                onPress={onClose}
                scaleTo={0.92}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={18} color={theme.colors.textSecondary} />
              </PremiumPressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Visitor Type */}
              <Text style={styles.fieldLabel}>Type of Arrival</Text>
              <View style={styles.typeRow}>
                {VISITOR_TYPES.map((t) => {
                  const isSelected = visitorType === t.type;
                  return (
                    <PremiumPressable
                      key={t.type}
                      style={[styles.typePill, isSelected && styles.typePillSelected]}
                      onPress={() => { setVisitorType(t.type); setUnitId(''); setUnitSearch(''); }}
                      scaleTo={0.96}
                    >
                      <Feather name={t.icon} size={15} color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} />
                      <Text style={[styles.typePillText, isSelected && styles.typePillTextSelected]}>{t.label}</Text>
                    </PremiumPressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Notify Target</Text>
              <View style={styles.targetRow}>
                <PremiumPressable
                  style={[styles.targetPill, targetType === 'RESIDENCE' && styles.targetPillSelected]}
                  onPress={() => { setTargetType('RESIDENCE'); clearTarget(); }}
                  scaleTo={0.97}
                >
                  <Feather name="home" size={15} color={targetType === 'RESIDENCE' ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[styles.targetPillText, targetType === 'RESIDENCE' && styles.targetPillTextSelected]}>Residence</Text>
                </PremiumPressable>
                <PremiumPressable
                  style={[styles.targetPill, targetType === 'MANAGER' && styles.targetPillSelected]}
                  onPress={() => { setTargetType('MANAGER'); clearTarget(); }}
                  scaleTo={0.97}
                >
                  <Feather name="shield" size={15} color={targetType === 'MANAGER' ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[styles.targetPillText, targetType === 'MANAGER' && styles.targetPillTextSelected]}>Manager</Text>
                </PremiumPressable>
              </View>

              {/* Unit Selection */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>
                  {targetType === 'RESIDENCE' ? 'Residence Unit ' : 'Manager '}
                  <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.unitSearchWrapper, focusedField === 'unit' && styles.inputFocused]}>
                  <Feather name={targetType === 'RESIDENCE' ? 'home' : 'user'} size={16} color={theme.colors.textSecondary} style={styles.unitIcon} />
                  <TextInput
                    style={styles.unitInput}
                    placeholder={targetType === 'RESIDENCE' ? 'Search unit number (e.g. 7B)' : 'Search manager name'}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={targetType === 'RESIDENCE' ? unitSearch : hostSearch}
                    onChangeText={(v) => {
                      if (targetType === 'RESIDENCE') {
                        setUnitSearch(v.toUpperCase());
                        setShowUnitDropdown(true);
                      } else {
                        setHostSearch(v);
                        setShowHostDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      setFocusedField('unit');
                      if (targetType === 'RESIDENCE') {
                        setShowUnitDropdown(true);
                      } else {
                        setShowHostDropdown(true);
                      }
                    }}
                    onBlur={() => { setFocusedField(null); setTimeout(() => { setShowUnitDropdown(false); setShowHostDropdown(false); }, 200); }}
                    autoCapitalize={targetType === 'RESIDENCE' ? 'characters' : 'words'}
                  />
                  {(unitId || hostUserId) ? (
                    <PremiumPressable onPress={clearTarget} hitSlop={8}>
                      <Feather name="x" size={14} color={theme.colors.textSecondary} />
                    </PremiumPressable>
                  ) : null}
                </View>

                {targetType === 'RESIDENCE' && showUnitDropdown && unitSuggestions.length > 0 && (
                  <View style={styles.unitDropdown}>
                    {unitSuggestions.map((u) => (
                      <PremiumPressable key={u.id} style={styles.unitOption} onPress={() => { setUnitId(u.id); setUnitSearch(u.unitNumber); setShowUnitDropdown(false); }}>
                        <Text style={styles.unitOptionText}>{u.unitNumber}</Text>
                      </PremiumPressable>
                    ))}
                  </View>
                )}

                {targetType === 'MANAGER' && showHostDropdown && hostSuggestions.length > 0 && (
                  <View style={styles.unitDropdown}>
                    {hostSuggestions.map((host) => (
                      <PremiumPressable key={host.id} style={styles.unitOption} onPress={() => { setHostUserId(host.id); setHostSearch(hostLabel(host)); setShowHostDropdown(false); }}>
                        <Text style={styles.unitOptionText}>{hostLabel(host)}</Text>
                        <Text style={styles.hostRole}>{host.role === 'LEADERSHIP' ? 'Leadership' : 'Manager'}</Text>
                      </PremiumPressable>
                    ))}
                  </View>
                )}
              </View>

              {/* External Service Fields */}
              {isExternal && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>
                    {'Provider '}
                    <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, focusedField === 'provider' && styles.inputFocused]}
                    placeholder="Enter provider name (e.g. Amazon, Uber, Swiggy)"
                    value={provider}
                    onChangeText={setProvider}
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('provider')}
                    onBlur={() => setFocusedField(null)}
                  />

                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>
                    {'Access Window '}
                    <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.chipsRow}>
                    {DURATIONS.map((d) => (
                      <PremiumPressable
                        key={d.minutes}
                        style={[styles.chip, duration === d.minutes && styles.chipSelected]}
                        onPress={() => setDuration(d.minutes)}
                        scaleTo={0.96}
                      >
                        <Text style={[styles.chipText, duration === d.minutes && styles.chipTextSelected]}>{d.label}</Text>
                      </PremiumPressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Guest/Service Fields */}
              {!isExternal && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>
                    {'Visitor Name '}
                    <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                    placeholder="Enter visitor name"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={theme.colors.textSecondary}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              )}

              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>
                  {visitorType === 'SERVICE' ? 'Service Purpose ' : 'Purpose (Optional)'}
                  {visitorType === 'SERVICE' ? <Text style={styles.required}>*</Text> : null}
                </Text>
                <TextInput
                  style={[styles.input, focusedField === 'purpose' && styles.inputFocused]}
                  placeholder={visitorType === 'SERVICE' ? 'e.g. AC Repair, Plumbing' : 'e.g. Family visit, Meeting'}
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholderTextColor={theme.colors.textSecondary}
                  onFocus={() => setFocusedField('purpose')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Vehicle Number (Optional)</Text>
                <TextInput
                  style={[styles.input, focusedField === 'vehicle' && styles.inputFocused]}
                  placeholder="e.g. KA-01-AB-1234"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.textSecondary}
                  onFocus={() => setFocusedField('vehicle')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Mobile Number (Optional)</Text>
                <TextInput
                  style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.textSecondary}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.infoCard, { marginTop: 12 }]}>
                <View style={styles.infoIcon}>
                  <Feather name={requiresOtp ? 'shield' : 'check-circle'} size={18} color={requiresOtp ? theme.colors.primary : '#10B981'} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoTitle}>
                    {requiresOtp ? 'OTP will be generated for guest' : 'Instant Gate Access'}
                  </Text>
                  <Text style={styles.infoDesc}>
                    {requiresOtp
                      ? 'Share the 6-digit OTP with your guest. Security will verify it upon arrival.'
                      : 'The security watchman will record entry directly. No OTP needed.'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 20 }}>
              <Button
                label={targetType === 'MANAGER' ? 'Alert Manager' : 'Alert Residence'}
                icon="shield"
                onPress={handleCreate}
                loading={submitting}
                disabled={!canSubmit() || submitting}
                style={styles.actionBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 61, 42, 0.06)',
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
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
    width: 36,
    height: 36,
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
  required: {
    color: '#DC2626',
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
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
  },
  typePillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
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
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  targetPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  targetPillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  targetPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  targetPillTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  unitSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  unitIcon: {
    marginRight: 4,
  },
  unitInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  unitDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  unitOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unitOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  hostRole: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#FFFFFF',
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
    marginBottom: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF4EC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE3D3',
    marginTop: 6,
    marginBottom: 12,
    gap: 10,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
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
    marginBottom: 2,
  },
  infoDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
    color: '#4A6B56',
  },
  actionBtn: {
    width: '100%',
  },
  inputFocused: {
    borderColor: theme.colors.primary,
  },
});
