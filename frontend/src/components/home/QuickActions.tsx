import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { homeLayout } from './homeSurface';
import { useResponsive } from '../../hooks/useResponsive';

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

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, onEditPress }) => {
  const {
    containerWidth,
    pagePadding,
    quickActionCols,
    quickActionGap,
    chipSize,
    chipRadius,
    iconSize,
    isTablet,
  } = useResponsive();

  const availableWidth = containerWidth - pagePadding * 2;
  const itemWidth = (availableWidth - quickActionGap * (quickActionCols - 1)) / quickActionCols;

  const rows: ActionItemConfig[][] = [];
  for (let i = 0; i < actions.length; i += quickActionCols) {
    rows.push(actions.slice(i, i + quickActionCols));
  }

  return (
    <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
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

      <View style={[styles.grid, { gap: quickActionGap }]}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.gridRow, { gap: quickActionGap }]}>
            {row.map((action) => (
              <PremiumPressable
                key={action.id}
                style={[styles.actionIcon, { width: itemWidth }]}
                onPress={action.onPress}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      width: chipSize,
                      height: chipSize,
                      borderRadius: chipRadius,
                      backgroundColor: action.iconBgColor,
                    },
                  ]}
                >
                  <Feather name={action.icon} size={iconSize} color={action.iconColor} />
                </View>
                <Text
                  style={[styles.actionLabel, isTablet && styles.actionLabelTablet]}
                  numberOfLines={2}
                >
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
    marginBottom: 8,
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
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  actionIcon: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingVertical: 4,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 15,
  },
  actionLabelTablet: {
    fontSize: 12.5,
    lineHeight: 16,
  },
});
