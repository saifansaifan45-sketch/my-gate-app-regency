import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { BottomSheet } from '../ui/BottomSheet';
import { theme } from '../../theme';

interface CommunitySheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
}

export function CommunitySheet({ visible, title, subtitle, onClose, children, footer, scrollable = true }: CommunitySheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', flex: 1, justifyContent: 'center' }}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.titleWrap}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <PremiumPressable style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={22} color={theme.colors.textPrimary} />
            </PremiumPressable>
          </View>

          {scrollable ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    width: '100%',
    shadowColor: '#081C11',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
});
