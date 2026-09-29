import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { api } from '../api/client';
import { AvailabilityStatus } from './availability-badge';
import { Button } from './ui/Button';
import { CenterModal } from './ui/CenterModal';
import { PremiumPressable } from './ui/PremiumPressable';
import { Text } from './ui/Text';
import { theme } from '../theme';
import { useResponsive } from '../hooks/useResponsive';

const OPTIONS: Array<{ value: AvailabilityStatus; label: string; description: string }> = [
  { value: 'AVAILABLE', label: 'Available', description: 'Residents and staff can expect a response.' },
  { value: 'AWAY', label: 'Away', description: 'You are away for a short period.' },
  { value: 'HOLIDAY', label: 'Holiday', description: 'You are away on holiday.' },
  { value: 'DO_NOT_DISTURB', label: 'Do not disturb', description: 'Avoid non-urgent contact.' },
];

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; dot: string; bg: string; border: string; text: string }> = {
  AVAILABLE: {
    label: 'Available',
    dot: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    text: '#065F46',
  },
  AWAY: {
    label: 'Away',
    dot: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.22)',
    text: '#92400E',
  },
  HOLIDAY: {
    label: 'Holiday',
    dot: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.22)',
    text: '#1E40AF',
  },
  DO_NOT_DISTURB: {
    label: 'Do Not Disturb',
    dot: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.22)',
    text: '#991B1B',
  },
};

function formatAvailabilityDate(value: string | null) {
  if (!value) return 'No end time';
  return new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function AvailabilityEditor() {
  const { pagePadding } = useResponsive();
  const [status, setStatus] = useState<AvailabilityStatus>('AVAILABLE');
  const [until, setUntil] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<AvailabilityStatus>('AVAILABLE');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    api.get('/profile/availability')
      .then((response) => {
        const nextStatus = (response.data?.availability?.availabilityStatus || 'AVAILABLE') as AvailabilityStatus;
        setStatus(nextStatus);
        setDraftStatus(nextStatus);
        setUntil(response.data?.availability?.availabilityUntil || null);
      })
      .catch(() => setError('Availability could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await api.patch('/profile/availability', {
        status: draftStatus,
        until: draftStatus === 'AVAILABLE' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      setStatus(response.data.availability.availabilityStatus);
      setUntil(response.data.availability.availabilityUntil);
      setModalVisible(false);
    } catch {
      setError('Availability could not be updated. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = () => {
    setDraftStatus(status);
    setError('');
    setModalVisible(true);
  };

  const currentConfig = STATUS_CONFIG[status] || STATUS_CONFIG.AVAILABLE;

  return (
    <>
      <View style={[styles.wrapper, { paddingHorizontal: pagePadding }]}>
        <PremiumPressable
          style={styles.glassPill}
          onPress={openEditor}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`Availability: ${currentConfig.label}. Tap to change.`}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
          ) : (
            <View style={[styles.dotWrapper, { backgroundColor: currentConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: currentConfig.dot }]} />
            </View>
          )}

          <View style={styles.contentGroup}>
            <Text style={styles.prefixText}>Availability:</Text>
            <Text style={[styles.statusText, { color: currentConfig.text }]}>{currentConfig.label}</Text>
            {!loading && status !== 'AVAILABLE' && until ? (
              <Text style={styles.untilText} numberOfLines={1}>
                · Until {formatAvailabilityDate(until)}
              </Text>
            ) : null}
          </View>

          <View style={styles.chevronBox}>
            <Feather name="chevron-down" size={13} color="#6B7280" />
          </View>
        </PremiumPressable>
      </View>

      <CenterModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <Feather name="activity" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>Set Availability</Text>
              <Text style={styles.modalSubtitle}>Let residents and staff know your availability status.</Text>
            </View>
          </View>

          <View style={styles.options}>
            {OPTIONS.map((option) => {
              const selected = draftStatus === option.value;
              const optConfig = STATUS_CONFIG[option.value];
              return (
                <PremiumPressable
                  key={option.value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setDraftStatus(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.optionBadge, { backgroundColor: optConfig.bg, borderColor: optConfig.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: optConfig.dot }]} />
                    <Text style={[styles.optionBadgeText, { color: optConfig.text }]}>{optConfig.label}</Text>
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </PremiumPressable>
              );
            })}
          </View>

          {draftStatus !== 'AVAILABLE' ? (
            <Text style={styles.helper}>Away statuses are set for 24 hours and can be changed anytime.</Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setModalVisible(false)}
              disabled={saving}
              style={styles.actionButton}
            />
            <Button
              label="Save"
              onPress={save}
              loading={saving}
              disabled={saving}
              style={styles.actionButton}
            />
          </View>
        </View>
      </CenterModal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1.5,
    gap: 7,
  },
  dotWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  loader: {
    marginRight: 2,
  },
  contentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  prefixText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#6B7280',
    includeFontPadding: false,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  untilText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#6B7280',
    maxWidth: 160,
  },
  chevronBox: {
    marginLeft: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surfaceOverlay,
    borderRadius: theme.radii.xxl,
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  options: {
    gap: 8,
  },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: theme.radii.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceInput,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceGreen,
  },
  optionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
  },
  optionDescription: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  helper: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: theme.status.danger.foreground,
    marginTop: 10,
  },
});
