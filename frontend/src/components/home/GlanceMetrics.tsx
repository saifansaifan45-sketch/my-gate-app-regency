import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { homeLayout, homeSurface } from './homeSurface';

export interface GlanceCardItem {
  key: string;
  label: string;
  count: string;
  subtitle: string;
  countColor: string;
  onPress: () => void;
}

interface GlanceMetricsProps {
  cards: GlanceCardItem[];
  onViewAllPress: () => void;
}

const GRID_GAP = 10;
const COLS = 3;

export const GlanceMetrics: React.FC<GlanceMetricsProps> = ({ cards, onViewAllPress }) => {
  const { width: screenWidth } = useWindowDimensions();
  const containerPadding = homeLayout.pagePadding * 2;
  const availableWidth = screenWidth - containerPadding;
  const itemWidth = (availableWidth - GRID_GAP * (COLS - 1)) / COLS;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Today at a glance</Text>
        <PremiumPressable
          style={styles.viewAllBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onViewAllPress}
          scaleTo={0.94}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Feather name="chevron-right" size={15} color="#166534" />
        </PremiumPressable>
      </View>

      <View style={styles.grid}>
        {cards.slice(0, COLS).map((card) => (
          <PremiumPressable
            key={card.key}
            style={[homeSurface, styles.card, { width: itemWidth }]}
            onPress={card.onPress}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${card.count}`}
          >
            <Text style={styles.label} numberOfLines={2}>{card.label}</Text>
            <Text style={[styles.count, { color: card.countColor }]} numberOfLines={1}>
              {card.count}
            </Text>
            <Text style={styles.subtitle}>{card.subtitle}</Text>
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
    marginBottom: homeLayout.headingSpacing,
  },
  sectionTitle: homeLayout.sectionTitle,
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#166534',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    padding: 14,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  count: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
  },
});