import { TextStyle, ViewStyle } from 'react-native';

/** Shared Regency Salma geometry for every elevated product surface. */
export const cardSystem = {
  pagePadding: 16,
  sectionSpacing: 24,
  headingSpacing: 14,
  radius: 22,
  padding: 16,
  actionHeight: 112,
  iconSize: 52,
  iconRadius: 16,
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 23,
    color: '#111827',
    letterSpacing: -0.2,
  } as TextStyle,
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: '#6B7280',
  } as TextStyle,
};

export const cardSurface: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: cardSystem.radius,
  borderWidth: 1,
  borderColor: 'rgba(20, 61, 42, 0.06)',
  shadowColor: '#143D2A',
  shadowOffset: { width: 0, height: 7 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 3,
};
