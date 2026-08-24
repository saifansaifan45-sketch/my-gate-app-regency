import { PremiumPressable } from './ui/PremiumPressable';
import { Button } from './ui/Button';
import { Feather } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Switch, useWindowDimensions, Keyboard, Platform, ScrollView, Text as RNText } from 'react-native';
import { Text } from './ui/Text';
import { theme } from '../theme';
import { useScreenInsets } from '../hooks/useScreenInsets';
import * as Haptics from 'expo-haptics';

export interface QuickActionItem {
  id: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  bgColor: string;
  iconColor: string;
  visible: boolean;
}

interface QuickActionsEditorModalProps {
  visible: boolean;
  actions: QuickActionItem[];
  onClose: () => void;
  onSave: (updated: QuickActionItem[]) => void;
}

const MAX_SHEET_HEIGHT_RATIO = 0.75;

export function QuickActionsEditorModal({ visible, actions, onClose, onSave }: QuickActionsEditorModalProps) {
  const { bottomClearance } = useScreenInsets(false);
  const { height: screenHeight } = useWindowDimensions();
  const maxHeight = screenHeight * MAX_SHEET_HEIGHT_RATIO;
  const [localActions, setLocalActions] = useState<QuickActionItem[]>(actions);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalActions(actions);
      Keyboard.dismiss();
    }
  }, [visible, actions]);

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSave(localActions);
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleAction = (id: string) => {
    const updated = localActions.map(a =>
      a.id === id ? { ...a, visible: !a.visible } : a
    );
    if (updated.filter(a => a.visible).length === 0) return;
    setLocalActions(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localActions.length) return;
    const updated = [...localActions];
    const [item] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, item);
    setLocalActions(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const moveUp = (index: number) => moveItem(index, index - 1);
  const moveDown = (index: number) => moveItem(index, index + 1);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'ios' ? 'none' : 'slide'}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}><View /></Pressable>
      <View style={[styles.sheet, { maxHeight }]}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Edit quick actions</Text>
          <Text style={styles.subtitle}>Choose which actions appear on your Home screen.</Text>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {localActions.map((action, index) => (
            <View key={action.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.dragHandle, { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                  <Feather name="menu" size={16} color={theme.colors.textSecondary} />
                </View>
                <View style={[styles.iconContainer, { backgroundColor: action.bgColor }]}>
                  <Feather name={action.icon} size={18} color={action.iconColor} />
                </View>
                <Text style={styles.rowLabel}>{action.label}</Text>
              </View>
              <View style={styles.rowRight}>
                <Switch
                  value={action.visible}
                  onValueChange={() => toggleAction(action.id)}
                  trackColor={{ true: theme.colors.primary, false: 'rgba(0,0,0,0.1)' }}
                  thumbColor={action.visible ? theme.colors.primary : '#fff'}
                  accessibilityLabel={`${action.label} ${action.visible ? 'enabled' : 'disabled'}`}
                  accessibilityRole="switch"
                />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 20 + bottomClearance }]}>
          <View style={styles.buttonRow}>
            <Button
              label="Cancel"
              variant="outline"
              size="md"
              onPress={onClose}
              disabled={saveLoading}
              style={styles.cancelBtn}
            />
            <Button
              label={saveLoading ? 'Saving...' : 'Save changes'}
              variant="primary"
              size="md"
              onPress={handleSave}
              disabled={saveLoading}
              loading={saveLoading}
              style={styles.saveBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  arrows: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
  },
});