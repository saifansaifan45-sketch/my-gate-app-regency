import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { homeLayout } from './homeSurface';

export interface ActionItemConfig {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconColor: string;
  iconBgColor: string;
  onPress: () => void;
}

interface QuickActionsProps {
  actions: ActionItemConfig[];
  onEditPress: () => void;
}

const CHIP_SIZE = 72;
const CHIP_RADIUS = 22;
const ICON_SIZE = 34;

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, onEditPress }) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <PremiumPressable
          style={styles.editBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onEditPress}
          scaleTo={0.94}
        >
          <Text style={styles.editText}>Edit</Text>
        </PremiumPressable>
      </View>

      {/* Flexible action grid keeps expanded household utilities easy to scan. */}
      <View style={styles.gridRow}>
        {actions.map((action) => (
          <PremiumPressable
            key={action.id}
            style={styles.actionIcon}
            onPress={action.onPress}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={[styles.iconBox, { backgroundColor: action.iconBgColor }]}>
              <Feather name={action.icon} size={ICON_SIZE} color={action.iconColor} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {action.label}
            </Text>
          </PremiumPressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: homeLayout.sectionTitle,
  editBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#166534',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    columnGap: 16,
    rowGap: 18,
  },
  actionIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  iconBox: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 16,
  },
});
