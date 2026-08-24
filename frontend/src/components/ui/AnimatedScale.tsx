import React, { useEffect, useRef } from 'react';
import { Platform, Animated, ViewStyle } from 'react-native';

interface AnimatedScaleProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

export function AnimatedScale({
  children,
  delay = 0,
  style,
}: AnimatedScaleProps) {
  const scale = useRef(new Animated.Value(0.1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  }, [delay, opacity, scale]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}
