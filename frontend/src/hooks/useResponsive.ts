import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  PHONE_MAX: 599,
  TABLET_MIN: 600,
  IPAD_MIN: 768,
  WIDE_TABLET_MIN: 900,
  DESKTOP_MIN: 1200,
} as const;

export const APP_MAX_WIDTHS = {
  PHONE: 440,
  TABLET: 720,
  WIDE_TABLET: 840,
} as const;

export interface ResponsiveInfo {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isIpad: boolean;
  isWideTablet: boolean;
  isDesktop: boolean;
  maxAppWidth: number;
  containerWidth: number;
  pagePadding: number;
  glanceGap: number;
  quickActionCols: number;
  quickActionGap: number;
  chipSize: number;
  chipRadius: number;
  iconSize: number;
}

/**
 * Standardized responsive layout hook for Regency Salma.
 * Computes device class, viewport boundaries, container width constraints,
 * and component layout metrics for Phone, Tablet, iPad, and Desktop viewports.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isPhone = width < BREAKPOINTS.TABLET_MIN;
  const isTablet = width >= BREAKPOINTS.TABLET_MIN;
  const isIpad = width >= BREAKPOINTS.IPAD_MIN;
  const isWideTablet = width >= BREAKPOINTS.WIDE_TABLET_MIN;
  const isDesktop = width >= BREAKPOINTS.DESKTOP_MIN;

  const maxAppWidth = isWideTablet
    ? APP_MAX_WIDTHS.WIDE_TABLET
    : isTablet
    ? APP_MAX_WIDTHS.TABLET
    : APP_MAX_WIDTHS.PHONE;

  const containerWidth = Math.min(width, maxAppWidth);

  const pagePadding = isTablet ? 16 : 12;
  const glanceGap = isTablet ? 12 : 8;
  const quickActionCols = isWideTablet ? 8 : isTablet ? 6 : 4;
  const quickActionGap = isTablet ? 12 : 8;

  const chipSize = isTablet ? 64 : 58;
  const chipRadius = isTablet ? 19 : 17;
  const iconSize = isTablet ? 28 : 26;

  return {
    width,
    height,
    isPhone,
    isTablet,
    isIpad,
    isWideTablet,
    isDesktop,
    maxAppWidth,
    containerWidth,
    pagePadding,
    glanceGap,
    quickActionCols,
    quickActionGap,
    chipSize,
    chipRadius,
    iconSize,
  };
}
