import { shadowBox } from './utils/shadow';

export const theme = {
  colors: {
    primary: '#143D2A', // Deep Hunter Green
    primaryPressed: '#0F3021',
    background: '#F6F4ED', // Warm stone backdrop for visual separation between surfaces
    surface: '#FFFEFB',
    surfaceMuted: '#EEEAE0',
    surfacePressed: '#E6E2D7',
    surfaceGreen: '#EDF6EF',
    surfaceAmber: '#FFF5E5',
    surfaceBlue: '#EEF4FB',
    surfaceTerracotta: '#FAEEE9',
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
    xs: 3,
    s: 6,
    m: 12,
    l: 20,
    xl: 28,
    xxl: 40,
  },
  radii: {
    s: 6,
    m: 10,
    l: 14,
    xl: 18,
    xxl: 22,
    pill: 100,
  },
  typography: {
    display: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      color: '#111827',
    },
    heading: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.3,
      color: '#111827',
    },
    subheading: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: -0.1,
      color: '#111827',
    },
    body: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: '#111827',
    },
    bodyMedium: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 14,
      lineHeight: 20,
      color: '#111827',
    },
    bodySecondary: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: '#6B7280',
    },
    label: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 12,
      letterSpacing: 0.1,
      color: '#111827',
    },
    caption: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 11,
      color: '#6B7280',
    },
  },
  shadows: {
    card: shadowBox('#143D2A', 0, 4, 0.06, 12, 2),
    floating: shadowBox('#143D2A', 0, 6, 0.12, 16, 6),
  },
};
