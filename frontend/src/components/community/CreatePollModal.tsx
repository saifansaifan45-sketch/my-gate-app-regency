import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { CommunitySheet } from './CommunitySheet';
import { theme } from '../../theme';
import { communityApi, CreatePollPayload, PollAudience } from '../../api/community';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

interface CreatePollModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (payload: CreatePollPayload) => Promise<unknown>;
  canChooseAudience?: boolean;
  householdUnitId?: string;
}

export function CreatePollModal({ visible, onClose, onSubmit, canChooseAudience = false, householdUnitId }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [selectedAudiences, setSelectedAudiences] = useState<PollAudience[]>(canChooseAudience ? ['RESIDENTS'] : ['HOUSEHOLD']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuestion('');
      setOptions(['', '']);
      setSelectedAudiences(canChooseAudience ? ['RESIDENTS'] : ['HOUSEHOLD']);
      setError('');
      setSubmitting(false);
      setCreated(false);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
    setTimeout(() => setCreated(false), 300);
  };

  const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const hasEnoughOptions = trimmedOptions.length >= MIN_OPTIONS;
  const hasDuplicates = new Set(trimmedOptions.map((o) => o.toLowerCase())).size !== trimmedOptions.length;
  const canSubmit = question.trim().length > 0 && hasEnoughOptions && selectedAudiences.length > 0 && !hasDuplicates && !submitting;

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAudience = (audience: PollAudience) => {
    setSelectedAudiences((current) => current.includes(audience)
      ? current.filter((item) => item !== audience)
      : [...current, audience]);
  };

  const handleSubmit = async () => {
    if (question.trim().length === 0) {
      setError('Poll question is required.');
      return;
    }
    if (!hasEnoughOptions) {
      setError(`Add at least ${MIN_OPTIONS} options.`);
      return;
    }
    if (hasDuplicates) {
      setError('Poll options must be unique.');
      return;
    }
    if (selectedAudiences.length === 0) {
      setError('Choose at least one audience.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const submit = onSubmit ?? ((payload: CreatePollPayload) => communityApi.createPollInDefaultSpace(payload));
      await submit({
        question: question.trim(),
        options: trimmedOptions,
        audience: selectedAudiences[0],
        audiences: selectedAudiences,
        ...(selectedAudiences.includes('HOUSEHOLD') && householdUnitId ? { unitId: householdUnitId } : {}),
      });
      setCreated(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const actionButtons = (
    <View style={styles.actionRow}>
      <Button label="Cancel" variant="secondary" onPress={handleClose} style={styles.actionBtnHalf} />
      <Button label="Create Poll" icon="pie-chart" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} style={styles.actionBtnHalf} />
    </View>
  );

  return (
    <CommunitySheet visible={visible} title="Create Poll" onClose={handleClose} footer={created ? undefined : actionButtons}>
      {created ? (
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Feather name="check" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Poll created</Text>
          <Text style={styles.successDesc}>Your poll is now open for community voting.</Text>
          <Button label="Done" variant="secondary" onPress={handleClose} style={styles.actionBtn} />
        </View>
      ) : (
        <>
          {error ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-triangle" size={16} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Question"
            placeholder="Should we organize a weekend cleanup?"
            placeholderTextColor="#9CA3AF"
            value={question}
            onChangeText={setQuestion}
          />

          {canChooseAudience ? (
            <View style={styles.audienceSection}>
              <Text style={styles.fieldLabel}>Who can vote?</Text>
              <Text style={styles.audienceHint}>Select one or more groups.</Text>
              <View style={styles.audienceRow}>
                {([
                  { id: 'RESIDENTS', label: 'Residents' },
                  { id: 'OWNERS', label: 'Owners' },
                  { id: 'LEADERSHIP', label: 'Leadership' },
                ] as const).map((option) => (
                  <PremiumPressable
                    key={option.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedAudiences.includes(option.id) }}
                    accessibilityLabel={`Allow ${option.label} to vote`}
                    style={[styles.audienceChip, selectedAudiences.includes(option.id) && styles.audienceChipActive]}
                    onPress={() => toggleAudience(option.id)}
                  >
                    <Feather name={selectedAudiences.includes(option.id) ? 'check' : 'plus'} size={14} color={selectedAudiences.includes(option.id) ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.audienceText, selectedAudiences.includes(option.id) && styles.audienceTextActive]}>{option.label}</Text>
                  </PremiumPressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.scopeNote}>
              <Feather name="home" size={16} color={theme.colors.primary} />
              <Text style={styles.scopeNoteText}>Only people connected to your residence can see and vote on this poll.</Text>
            </View>
          )}

          <View style={styles.optionsHeader}>
            <Text style={styles.fieldLabel}>Options</Text>
            <Text style={styles.optionCount}>{options.length}/{MAX_OPTIONS}</Text>
          </View>

          {options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#9CA3AF"
                value={option}
                onChangeText={(t) => updateOption(index, t)}
                maxLength={120}
              />
              {options.length > MIN_OPTIONS && (
                <PremiumPressable
                  style={styles.removeBtn}
                  onPress={() => removeOption(index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove option ${index + 1}`}
                >
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </PremiumPressable>
              )}
            </View>
          ))}

          {options.length < MAX_OPTIONS && (
            <PremiumPressable style={styles.addOptionBtn} onPress={addOption} activeOpacity={0.85}>
              <Feather name="plus" size={18} color={theme.colors.primary} />
              <Text style={styles.addOptionText}>Add option</Text>
            </PremiumPressable>
          )}

          {hasDuplicates && <Text style={styles.hintError}>Options must be unique.</Text>}
        </>
      )}
    </CommunitySheet>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audienceSection: { marginTop: 4, marginBottom: 12 },
  audienceHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: theme.colors.textSecondary, marginTop: -3, marginBottom: 8 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  audienceChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  audienceChipActive: { borderColor: theme.colors.primary, backgroundColor: '#EEF8F1' },
  audienceText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: theme.colors.textSecondary },
  audienceTextActive: { color: theme.colors.primary },
  scopeNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF8F1', borderRadius: 12, padding: 12, marginBottom: 14 },
  scopeNoteText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17, color: theme.colors.primary },
  optionCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    height: 58,
    paddingHorizontal: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 6,
  },
  addOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.primary,
  },
  hintError: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.error,
    marginBottom: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.errorBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.error,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtnHalf: {
    flex: 1,
  },
  actionBtn: {
    marginTop: 10,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 26,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  successDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
});
