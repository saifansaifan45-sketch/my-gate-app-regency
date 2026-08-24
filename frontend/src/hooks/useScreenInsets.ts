import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Standardized insets and clearance hook for all screens in the application.
 * 
 * @param isTabScreen Whether this screen is a root tab with the CustomTabBar mounted.
 * @returns { top, bottom, bottomClearance, tabClearance, subscreenClearance }
 */
export function useScreenInsets(isTabScreen = false) {
  const insets = useSafeAreaInsets();

  const tabClearance = insets.bottom + 84;
  const subscreenClearance = Math.max(insets.bottom, 16) + 24;

  return {
    top: Math.max(insets.top + 6, 20),
    bottom: insets.bottom,
    bottomClearance: isTabScreen ? tabClearance : subscreenClearance,
    tabClearance,
    subscreenClearance,
  };
}
