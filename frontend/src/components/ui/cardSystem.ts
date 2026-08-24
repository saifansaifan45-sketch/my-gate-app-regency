import { TextStyle, ViewStyle } from 'react-native';
import { theme } from '../../theme';

/** Shared Regency Salma geometry for every elevated product surface. */
export const cardSystem = {
  pagePadding: 12,
  sectionSpacing: 16,
  headingSpacing: 10,
  radius: 16,
  padding: 12,
  actionHeight: 88,
  iconSize: 40,
  iconRadius: 12,
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    letterSpacing: -0.1,
  } as TextStyle,
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  } as TextStyle,
};

export const cardSurface: ViewStyle = {
  backgroundColor: theme.colors.surface,
  borderRadius: cardSystem.radius,
  borderWidth: 1,
  borderColor: theme.colors.border,
  shadowColor: theme.colors.primary,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
};
