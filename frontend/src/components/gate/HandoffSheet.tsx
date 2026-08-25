import React from 'react';
import { View, StyleSheet, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { theme } from '../../theme';
import { VisitorItem } from '../../api/visitors';

interface HandoffSheetProps {
  visible: boolean;
  onClose: () => void;
  visitor: VisitorItem | null;
  onHandoff: (type: 'RESIDENT' | 'GATE' | 'LOCKER', name?: string) => void;
  isPending?: boolean;
}

const HANDOFF_OPTIONS: Array<{ type: 'RESIDENT' | 'GATE' | 'LOCKER'; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { type: 'RESIDENT' as const, label: 'Resident', icon: 'user' },
  { type: 'GATE' as const, label: 'Gate hold', icon: 'shield' },
  { type: 'LOCKER' as const, label: 'Locker', icon: 'lock' },
];

export function HandoffSheet({ visible, onClose, visitor, onHandoff, isPending }: HandoffSheetProps) {
  if (!visible || !visitor) return null;

  return (
    <View style={styles.overlay} onStartShouldSetResponder={() => true}>
      <View style={styles.backdrop} onTouchStart={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Record delivery handoff</Text>
          <Text style={styles.subtitle}>{visitor.provider || visitor.name || 'Delivery'}</Text>

          <Text style={styles.label}>Hand off to</Text>
          <View style={styles.options}>
            {HANDOFF_OPTIONS.map((opt) => (
              <PremiumPressable
                key={opt.type}
                style={styles.option}
                onPress={() => onHandoff(opt.type)}
              >
                <Feather name={opt.icon} size={16} color={theme.colors.textSecondary} />
                <Text style={styles.optionText}>{opt.label}</Text>
              </PremiumPressable>
            ))}
          </View>

          <TextInput
            style={styles.recipientInput}
            placeholder="Recipient name (optional)"
            placeholderTextColor={theme.colors.textSecondary}
          />

          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={isPending ? 'Recording...' : 'Record handoff'}
              variant="primary"
              size="md"
              onPress={onClose}
              disabled={isPending}
              loading={isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17,24,39,0.42)',
  },
  keyboardView: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  options: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  recipientInput: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
