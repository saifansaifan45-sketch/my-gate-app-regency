import { Platform, ViewStyle, TextStyle } from 'react-native';

/**
 * Convert React Native shadow properties to web-safe `boxShadow`.
 * On native, returns the original shadow properties unchanged.
 *
 * @example
 *   { ...shadowBox('#000', 0, 4, 0.08, 10) }
 *   // web:  { boxShadow: '0px 4px 10px rgba(0,0,0,0.08)' }
 *   // native: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 }
 */
export function shadowBox(
  color: string,
  offsetX: number,
  offsetY: number,
  opacity: number,
  radius: number,
  elevation?: number,
): ViewStyle {
  if (Platform.OS === 'web') {
    const [r, g, b] = hexToRgb(color);
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(${r},${g},${b},${opacity})`,
    } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: elevation ?? 2,
  };
}

/**
 * Convert React Native text shadow properties to web-safe `textShadow`.
 * On native, returns the original text shadow properties unchanged.
 */
export function textShadowBox(
  color: string,
  offsetX: number,
  offsetY: number,
  radius: number,
): TextStyle {
  if (Platform.OS === 'web') {
    const [r, g, b] = hexToRgb(color);
    return {
      textShadow: `${offsetX}px ${ offsetY}px ${radius}px rgba(${r},${g},${b},1)`,
    } as TextStyle;
  }
  return {
    textShadowColor: color,
    textShadowOffset: { width: offsetX, height: offsetY },
    textShadowRadius: radius,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
