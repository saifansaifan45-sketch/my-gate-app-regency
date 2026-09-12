import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Platform, KeyboardAvoidingView, Modal, Pressable } from 'react-native';
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
  const [selectedType, setSelectedType] = useState<'RESIDENT' | 'GATE' | 'LOCKER'>('RESIDENT');
  const [recipientName, setRecipientName] = useState('');

  if (!visitor) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.iconWrap}>
                <Feather name="package" size={20} color="#A16207" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Delivery Handoff</Text>
                <Text style={styles.subtitle}>
                  {'Recording delivery for '}
                  <Text style={styles.boldName}>{visitor.provider || visitor.name || 'Delivery'}</Text>
                </Text>
              </View>
              <PremiumPressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Feather name="x" size={16} color={theme.colors.textSecondary} />
              </PremiumPressable>
            </View>

            <Text style={styles.label}>Hand off to</Text>
            <View style={styles.options}>
              {HANDOFF_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <PremiumPressable
                    key={opt.type}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => setSelectedType(opt.type)}
                    scaleTo={0.96}
                  >
                    <Feather name={opt.icon} size={16} color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} />
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt.label}</Text>
                  </PremiumPressable>
                );
              })}
            </View>

            <TextInput
              style={styles.recipientInput}
              placeholder="Recipient name (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={recipientName}
              onChangeText={setRecipientName}
            />

            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
              <Button
                label={isPending ? 'Recording...' : 'Confirm Handoff'}
                variant="primary"
                size="md"
                onPress={() => onHandoff(selectedType, recipientName.trim() || undefined)}
                disabled={isPending}
                loading={isPending}
                style={{ flex: 1.5 }}
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
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16.5,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  boldName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.textPrimary,
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
    marginBottom: 14,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    backgroundColor: '#F9FAFB',
  },
  optionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  recipientInput: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
