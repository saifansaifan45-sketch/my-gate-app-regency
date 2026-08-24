import { shadowBox } from './utils/shadow';

export const theme = {
  colors: {
    primary: '#143D2A', // Deep Hunter Green
    primaryPressed: '#0F3021',
    background: '#F9F7F2', // Warm Off-White / Cream
    surface: '#FFFFFF',
    surfaceMuted: '#F1F0EA',
    surfacePressed: '#E8E7DF',
    textPrimary: '#111827', // Crisp Dark Charcoal
    textSecondary: '#6B7280', // Slate Gray
    accent: '#D27D67', // Muted Terracotta
    error: '#EF4444',
    errorBackground: '#FEE2E2',
    success: '#10B981',
    successBackground: '#D1FAE5',
    border: '#E5E7EB',
    focus: '#2C6B4A',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    s: 8,
    m: 12,
    l: 16,
    xl: 20,
    xxl: 24,
    pill: 100,
  },
  typography: {
    display: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 32,
      lineHeight: 38,
      letterSpacing: -0.6,
      color: '#111827',
    },
    heading: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.4,
      color: '#111827',
    },
    subheading: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 17,
      lineHeight: 24,
      letterSpacing: -0.2,
      color: '#111827',
    },
    body: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: '#111827',
    },
    bodyMedium: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 15,
      lineHeight: 22,
      color: '#111827',
    },
    bodySecondary: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: '#6B7280',
    },
    label: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 13,
      letterSpacing: 0.2,
      color: '#111827',
    },
    caption: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 12,
      color: '#6B7280',
    },
  },
  shadows: {
    card: shadowBox('#143D2A', 0, 5, 0.07, 14, 2),
    floating: shadowBox('#143D2A', 0, 8, 0.16, 20, 8),
  },
};
