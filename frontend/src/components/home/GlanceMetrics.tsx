import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { homeLayout, homeSurface } from './homeSurface';
import { theme } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

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

const metricSurfaces: Record<GlanceCardItem['key'], string> = {
  visitors: theme.colors.surfaceGreen,
  deliveries: theme.colors.surfaceAmber,
  maintenance: theme.colors.surfaceBlue,
};

export const GlanceMetrics: React.FC<GlanceMetricsProps> = ({ cards, onViewAllPress }) => {
  const { containerWidth, pagePadding, glanceGap, isTablet } = useResponsive();
  const availableWidth = containerWidth - pagePadding * 2;
  const numCards = Math.max(cards.length, 1);
  const itemWidth = (availableWidth - glanceGap * (numCards - 1)) / numCards;

  return (
    <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Today at a glance</Text>
        <PremiumPressable
          style={styles.viewAllBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onViewAllPress}
          scaleTo={0.94}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Feather name="chevron-right" size={15} color={theme.colors.primary} />
        </PremiumPressable>
      </View>

      <View style={[styles.grid, { gap: glanceGap }]}>
        {cards.map((card) => (
          <PremiumPressable
            key={card.key}
            style={[
              homeSurface,
              styles.card,
              isTablet && styles.cardTablet,
              {
                width: itemWidth,
                backgroundColor: metricSurfaces[card.key] || theme.colors.surface,
              },
            ]}
            onPress={card.onPress}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${card.count}`}
          >
            <Text style={[styles.label, isTablet && styles.labelTablet]} numberOfLines={2}>
              {card.label}
            </Text>
            <Text
              style={[
                styles.count,
                isTablet && styles.countTablet,
                { color: card.countColor },
              ]}
              numberOfLines={1}
            >
              {card.count}
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]} numberOfLines={1}>
              {card.subtitle}
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
    color: theme.colors.primary,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  card: {
    padding: 12,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  cardTablet: {
    padding: 16,
    minHeight: 104,
    borderRadius: 18,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  labelTablet: {
    fontSize: 13,
    marginBottom: 8,
  },
  count: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  countTablet: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  subtitleTablet: {
    fontSize: 12,
  },
});
