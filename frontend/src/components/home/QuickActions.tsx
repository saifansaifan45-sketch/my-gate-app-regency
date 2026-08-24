import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
const ITEMS_PER_ROW = 4;
const GRID_GAP = 12;

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, onEditPress }) => {
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = homeLayout.pagePadding * 2;
  const availableWidth = screenWidth - containerPadding;
  const itemWidth = (availableWidth - GRID_GAP * (ITEMS_PER_ROW - 1)) / ITEMS_PER_ROW;

  const rows: ActionItemConfig[][] = [];
  for (let i = 0; i < actions.length; i += ITEMS_PER_ROW) {
    rows.push(actions.slice(i, i + ITEMS_PER_ROW));
  }

  return (
    <View style={styles.container}>
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

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((action) => (
              <PremiumPressable
                key={action.id}
                style={[styles.actionIcon, { width: itemWidth }]}
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
    marginBottom: 14,
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
  grid: {
    gap: GRID_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: GRID_GAP,
  },
  actionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
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
