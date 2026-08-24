import { TextStyle, ViewStyle } from 'react-native';

/** Shared Regency Salma geometry for every elevated product surface. */
export const cardSystem = {
  pagePadding: 14,
  sectionSpacing: 20,
  headingSpacing: 12,
  radius: 18,
  padding: 14,
  actionHeight: 96,
  iconSize: 44,
  iconRadius: 14,
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
    color: '#111827',
    letterSpacing: -0.1,
  } as TextStyle,
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  } as TextStyle,
};

export const cardSurface: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: cardSystem.radius,
  borderWidth: 1,
  borderColor: 'rgba(20, 61, 42, 0.06)',
  shadowColor: '#143D2A',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
};
