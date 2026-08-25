import { ViewStyle, TextStyle } from 'react-native';
import { cardSurface, cardSystem } from '../ui/cardSystem';
import { theme } from '../../theme';

/**
 * The Home page follows the same quiet, elevated surface language as auth:
 * a clean white plane, restrained green depth, and generous internal space.
 * These tokens are the single source of truth for card surfaces, section
 * rhythm and icon-chip sizing across Home, Services and Profile.
 */
export const homeSurface: ViewStyle = cardSurface;

export const homeLayout = {
  pagePadding: cardSystem.pagePadding,
  sectionSpacing: cardSystem.sectionSpacing,
  headingSpacing: cardSystem.headingSpacing,
  headingSpacingSpacer: {
    height: cardSystem.headingSpacing,
  } as ViewStyle,
  cardRadius: cardSystem.radius,
  cardPadding: cardSystem.padding,
  cardPaddingLarge: cardSystem.padding,
  iconBox: cardSystem.iconSize,
  iconRadius: cardSystem.iconRadius,
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
    includeFontPadding: false,
  } as TextStyle,
  emptyState: {
    borderRadius: cardSystem.radius,
    backgroundColor: theme.colors.surfaceGreen,
    borderWidth: 1,
    borderColor: theme.status.success.border,
  } as ViewStyle,
};
