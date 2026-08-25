import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { CommunitySheet } from './CommunitySheet';
import { theme } from '../../theme';
import { communityApi, CreateAnnouncementPayload, AnnouncementPriority, AnnouncementCategory, AnnouncementAudience } from '../../api/community';

const PRIORITIES: AnnouncementPriority[] = ['NORMAL', 'IMPORTANT', 'URGENT'];
const CATEGORIES: AnnouncementCategory[] = ['GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT', 'EMERGENCY'];

const PRIORITY_META: Record<AnnouncementPriority, { label: string; bg: string; color: string }> = {
  NORMAL: { label: 'Normal', bg: '#E8F5E9', color: '#1B7A44' },
  IMPORTANT: { label: 'Important', bg: '#FEF3C7', color: '#D97706' },
  URGENT: { label: 'Urgent', bg: '#FEE2E2', color: '#DC2626' },
};

interface CreateAnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (payload: CreateAnnouncementPayload) => Promise<unknown>;
  canChooseAudience?: boolean;
}

export function CreateAnnouncementModal({ visible, onClose, onSubmit, canChooseAudience = false }: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [selectedAudiences, setSelectedAudiences] = useState<AnnouncementAudience[]>(['RESIDENTS']);
  const [category, setCategory] = useState<AnnouncementCategory>('GENERAL');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setPriority('NORMAL');
      setSelectedAudiences(['RESIDENTS']);
      setCategory('GENERAL');
      setError('');
      setSubmitting(false);
      setCreated(false);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
    setTimeout(() => setCreated(false), 300);
  };

  const toggleAudience = (audience: AnnouncementAudience) => {
    setSelectedAudiences((current) => current.includes(audience)
      ? current.filter((item) => item !== audience)
      : [...current, audience]);
  };

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      setError('Announcement title is required.');
      return;
    }
    if (description.trim().length === 0) {
      setError('Announcement description is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const submit = onSubmit ?? ((payload: CreateAnnouncementPayload) => communityApi.createAnnouncement(payload));
      if (selectedAudiences.length === 0) {
        setError('Choose at least one audience.');
        return;
      }
      await submit({ title: title.trim(), description: description.trim(), category, priority, status: 'PUBLISHED', expiryDate: null, audiences: selectedAudiences });
      setCreated(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommunitySheet visible={visible} title="New Announcement" onClose={handleClose}>
      {created ? (
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Feather name="check" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Announcement published</Text>
          <Text style={styles.successDesc}>Your announcement is now visible to the community.</Text>
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
            label="Title"
            placeholder="E.g. Water supply will be interrupted"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.textarea, error && title.trim().length > 0 ? styles.fieldError : null]}
            placeholder="Provide the important details..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            maxLength={600}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/600</Text>

          {canChooseAudience ? (
            <View style={styles.audienceSection}>
              <Text style={styles.fieldLabel}>Who should receive this notice?</Text>
              <Text style={styles.audienceHint}>Select one or more groups.</Text>
              <View style={styles.audienceRow}>
                {([
                  { id: 'RESIDENTS', label: 'Residents' },
                  { id: 'OWNERS', label: 'Owners' },
                  { id: 'LEADERSHIP', label: 'Leadership' },
                ] as const).map((audience) => {
                  const selected = selectedAudiences.includes(audience.id);
                  return (
                    <PremiumPressable
                      key={audience.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`Send notice to ${audience.label}`}
                      style={[styles.audienceChip, selected && styles.audienceChipActive]}
                      onPress={() => toggleAudience(audience.id)}
                    >
                      <Feather name={selected ? 'check' : 'plus'} size={14} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                      <Text style={[styles.audienceText, selected && styles.audienceTextActive]}>{audience.label}</Text>
                    </PremiumPressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const meta = PRIORITY_META[p];
              const selected = priority === p;
              return (
                <PremiumPressable
                  key={p}
                  style={[styles.priorityChip, { backgroundColor: selected ? meta.bg : theme.colors.background, borderColor: selected ? meta.color : theme.colors.border }]}
                  onPress={() => setPriority(p)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.priorityText, { color: selected ? meta.color : theme.colors.textSecondary }]}>{meta.label}</Text>
                </PremiumPressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((item) => <PremiumPressable key={item} style={[styles.categoryChip, category === item && styles.categoryChipActive]} onPress={() => setCategory(item)}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item.charAt(0) + item.slice(1).toLowerCase()}</Text></PremiumPressable>)}
          </View>

          <View style={styles.actionRow}>
            <Button label="Cancel" variant="secondary" onPress={handleClose} style={styles.actionBtnHalf} />
            <Button label="Publish" icon="send" onPress={handleSubmit} loading={submitting} style={styles.actionBtnHalf} />
          </View>
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
  textarea: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    minHeight: 130,
    padding: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  fieldError: {
    borderColor: theme.colors.error,
  },
  charCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 18,
  },
  audienceSection: { marginBottom: 18 },
  audienceHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: theme.colors.textSecondary, marginTop: -3, marginBottom: 8 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  audienceChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  audienceChipActive: { borderColor: theme.colors.primary, backgroundColor: '#EEF8F1' },
  audienceText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: theme.colors.textSecondary },
  audienceTextActive: { color: theme.colors.primary },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  priorityText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  categoryChip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 97, paddingHorizontal: 10, paddingVertical: 8 },
  categoryChipActive: { borderColor: theme.colors.primary, backgroundColor: '#EEF8F1' },
  categoryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  categoryTextActive: { color: theme.colors.primary },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  placeholderIcon: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
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
