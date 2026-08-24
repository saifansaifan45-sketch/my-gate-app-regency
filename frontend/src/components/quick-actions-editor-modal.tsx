import { Button } from './ui/Button';
import { Feather } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, Pressable, Switch, useWindowDimensions, Keyboard, ScrollView } from 'react-native';
import { Text } from './ui/Text';
import { theme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const dialogHeight = Math.min(
    screenHeight * MAX_SHEET_HEIGHT_RATIO,
    screenHeight - insets.top - insets.bottom - 32
  );
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom + 16, 32),
          },
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { height: dialogHeight }]}>
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
                <View style={styles.reorderControls}>
                  <Pressable
                    style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                    onPress={() => moveItem(index, index - 1)}
                    disabled={index === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${action.label} up`}
                  >
                    <Feather name="chevron-up" size={16} color={theme.colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={[styles.reorderButton, index === localActions.length - 1 && styles.reorderButtonDisabled]}
                    onPress={() => moveItem(index, index + 1)}
                    disabled={index === localActions.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${action.label} down`}
                  >
                    <Feather name="chevron-down" size={16} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
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

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reorderButton: {
    width: 28,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  arrows: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
  },
});
