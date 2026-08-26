import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { CommunitySheet } from './CommunitySheet';
import { theme } from '../../theme';
import { communityApi, CreatePostPayload, PostCategory } from '../../api/community';

const CATEGORIES: PostCategory[] = ['GENERAL', 'EVENT', 'DISCUSSION', 'UPDATE'];

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (payload: CreatePostPayload) => Promise<unknown>;
}

export function CreatePostModal({ visible, onClose, onSubmit }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent('');
      setCategory(null);
      setError('');
      setSubmitting(false);
      setCreated(false);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
    setTimeout(() => setCreated(false), 300);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Post content is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const submit = onSubmit ?? ((payload: CreatePostPayload) => communityApi.createPost(payload));
      await submit({ content: trimmed, category: category ?? undefined, imageUri: null });
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
      <Button label="Create Post" icon="send" onPress={handleSubmit} loading={submitting} style={styles.actionBtnHalf} />
    </View>
  );

  return (
    <CommunitySheet visible={visible} title="Create Post" onClose={handleClose} footer={created ? undefined : actionButtons}>
      {created ? (
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Feather name="check" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Post published</Text>
          <Text style={styles.successDesc}>Your update has been shared with the community.</Text>
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

          <Text style={styles.fieldLabel}>Content</Text>
          <TextInput
            style={[styles.textarea, error ? styles.fieldError : null]}
            placeholder="What's on your mind?"
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={5}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{content.length}/1000</Text>

          <Text style={styles.fieldLabel}>Category (optional)</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const selected = category === c;
              return (
                <PremiumPressable
                  key={c}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCategory(selected ? null : c)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</Text>
                </PremiumPressable>
              );
            })}
          </View>

          <View style={styles.placeholderRow}>
            <View style={styles.placeholderIcon}>
              <Feather name="image" size={18} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.placeholderText}>Add a photo (coming soon)</Text>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 98,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
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
    marginBottom: 22,
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
    marginTop: 4,
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