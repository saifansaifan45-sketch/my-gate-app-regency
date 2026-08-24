import React, { useEffect, useRef, useState } from 'react';
import { Platform, AccessibilityInfo, Animated, Easing, ViewStyle, StyleProp } from 'react-native';

interface ScreenEntranceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animation?: 'rise' | 'fade' | 'none';
  distance?: number;
}

/**
 * A brief, native-driver entrance for meaningful screen groups. It is deliberately
 * quiet: content is never delayed for longer than 240ms and Reduce Motion keeps it static.
 */
export function ScreenEntrance({ children, style, delay = 0, animation = 'rise', distance = 10 }: ScreenEntranceProps) {
  const opacity = useRef(new Animated.Value(animation === 'none' ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null || animation === 'none') return;

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(animation === 'rise' ? distance : 0);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, Math.min(delay, 240));

    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [animation, delay, distance, opacity, reduceMotion, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
